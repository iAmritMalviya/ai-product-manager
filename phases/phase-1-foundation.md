# Phase 1: Foundation

**Status:** Complete
**Depends on:** Nothing
**Delivers:** Bot connects to Telegram, captures group messages, health check responds

---

## What Gets Built

1. **Project scaffolding** — package.json, tsconfig, Docker Compose (PG + Redis), .env.example, pino logger
2. **grammY bot** — long-polling, connects to Telegram, listens to all group messages
3. **Group message middleware** — captures every text message, logs sender + text + chat ID
4. **`/ping` command** — bot responds "pong" (proves bot is alive and can reply)
5. **Hono HTTP server** — `/health` endpoint returns `{ status: "ok" }`
6. **Docker Compose** — PostgreSQL 16 + Redis 7 for local dev

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies: grammy, hono, pino, bullmq, dotenv, zod, tsx |
| `tsconfig.json` | Strict TS, ESM, NodeNext module resolution |
| `docker-compose.yml` | PG 16 + Redis 7 |
| `.env.example` | All env vars with placeholders |
| `src/index.ts` | Entry point — starts bot + HTTP server |
| `src/env.ts` | Zod-validated env parsing |
| `src/bot/bot.ts` | grammY bot instance + middleware registration |
| `src/bot/commands/ping.ts` | `/ping` → "pong" |
| `src/bot/middleware/group-message.ts` | Log every group message (later: enqueue) |
| `src/http/server.ts` | Hono app with `/health` |
| `src/lib/logger.ts` | pino logger with pretty-print in dev |

## Dependencies (npm)

```
grammy
hono
@hono/node-server
pino
pino-pretty (dev)
bullmq
ioredis
dotenv
zod
tsx (dev)
typescript (dev)
@types/node (dev)
vitest (dev)
```

## Docker Compose

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: supercfo
      POSTGRES_USER: supercfo
      POSTGRES_PASSWORD: supercfo
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

## Definition of Done

- [x] `docker compose up` starts PG + Redis without errors
- [x] `pnpm dev` starts the bot, logs "Bot started" with bot username
- [x] Send `/ping` in a Telegram group → bot replies "pong"
- [x] Send any text message in group → logged to console with sender name, chat ID, message text
- [x] `curl localhost:3000/health` returns `{"status":"ok"}`
- [x] TypeScript compiles with zero errors (`pnpm typecheck`)

## Notes

- **Privacy mode must be disabled** via @BotFather (`/setprivacy` → Disable) before adding bot to group. Otherwise bot only sees `/commands`.
- Long polling (not webhooks) — no public URL needed for dev.
- No database operations yet — just logging messages to console.
