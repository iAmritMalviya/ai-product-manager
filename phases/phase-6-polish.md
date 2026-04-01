# Phase 6: Polish

**Status:** Complete
**Depends on:** Phase 5 (all features working)
**Delivers:** Production-ready: error handling, graceful shutdown, observability, Docker build, CI

---

## What Gets Built

1. **Graceful shutdown** — SIGTERM/SIGINT cleanly stops bot, workers, queues, DB connections
2. **Error handling** — global error boundaries, dead-letter queue for failed jobs, structured error logging
3. **Retry policies** — BullMQ retry config: exponential backoff, max 3 retries, DLQ after failure
4. **Rate limiting** — OpenAI API rate limits, Telegram API rate limits, per-chat throttling
5. **Observability** — structured pino logs, request IDs through pipeline, job duration metrics
6. **Health checks** — `/health` (liveness), `/ready` (checks DB + Redis connectivity)
7. **Docker production build** — multi-stage Dockerfile, minimal image
8. **CI pipeline** — GitHub Actions: typecheck, lint, test, build
9. **Input validation** — sanitize message text, max length guards, injection prevention

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Updated: graceful shutdown handlers |
| `src/lib/errors.ts` | Custom error classes (AIError, DatabaseError, QueueError) |
| `src/lib/shutdown.ts` | Graceful shutdown orchestration |
| `src/http/server.ts` | Updated: `/ready` endpoint |
| `Dockerfile` | Multi-stage production build |
| `.github/workflows/ci.yml` | TypeCheck + Lint + Test + Build |
| `src/worker/message-ingest.worker.ts` | Updated: retry config, error handling, DLQ |
| `src/worker/bot-respond.worker.ts` | Updated: Telegram rate limit handling |

## Graceful Shutdown Order

```
SIGTERM received
    │
    v
1. Stop accepting new Telegram updates (bot.stop())
2. Close BullMQ workers (wait for active jobs to finish, 10s timeout)
3. Close BullMQ queues
4. Close Redis connection
5. Close DB connection pool
6. Stop HTTP server
7. Exit process
```

## Error Handling Strategy

| Error Type | Handling |
|-----------|----------|
| OpenAI API error (rate limit) | Retry with exponential backoff (BullMQ) |
| OpenAI API error (invalid response) | Log, skip message, don't retry |
| Telegram send error (rate limit) | Retry after `retry_after` seconds |
| Telegram send error (chat not found) | Log, mark team as inactive |
| DB connection error | Retry job, alert if persistent |
| Invalid message (too long, empty) | Skip, log warning |
| Unhandled error | Log full stack, move job to DLQ |

## BullMQ Job Config

```typescript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000  // 2s, 4s, 8s
  },
  removeOnComplete: { age: 86400 },  // keep 24h
  removeOnFail: { age: 604800 }      // keep 7 days in DLQ
}
```

## Docker Production Build

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: Run
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## CI Pipeline

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

## Observability

### Structured Logging
```typescript
// Every log line includes:
{
  level: "info",
  msg: "task_created",
  teamId: "uuid",
  taskId: "uuid",
  assignee: "amrit",
  source: "message-ingest-worker",
  jobId: "bull-123",
  durationMs: 450
}
```

### Key Metrics (logged, not pushed to metrics service yet)
- `message_processed_total` — count of messages through pipeline
- `message_classified` — count by classification category
- `task_created_total` — count of tasks created
- `ai_call_duration_ms` — OpenAI call latency
- `worker_job_duration_ms` — end-to-end job processing time
- `worker_job_failed_total` — failed job count

## Definition of Done

- [ ] Kill process with SIGTERM → clean shutdown, no orphaned connections
- [ ] OpenAI rate limit hit → job retried automatically, succeeds on next attempt
- [ ] Telegram rate limit hit → response delayed, delivered correctly
- [ ] Malformed message → skipped with warning log, doesn't crash worker
- [ ] Failed job after 3 retries → moved to DLQ, visible in logs
- [ ] `curl /ready` → returns 503 if DB or Redis is down
- [ ] `docker build .` → produces working production image
- [ ] `docker compose -f docker-compose.prod.yml up` → full stack runs
- [ ] GitHub Actions CI passes: typecheck + lint + test + build
- [ ] All logs are structured JSON in production
- [ ] No `console.log` anywhere — all logging through pino

## Notes

- Don't over-engineer observability — structured logs are enough for v1
- Prometheus/Grafana can come later when there's actual traffic to monitor
- DLQ inspection: `pnpm dlq:inspect` script to list failed jobs
- Consider adding Sentry or similar error tracking in a future iteration
- Docker image should be < 200MB
