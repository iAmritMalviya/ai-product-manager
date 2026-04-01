# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SuperCFO** — an AI-powered Telegram bot that acts as a project manager for group chats. It passively monitors conversations, uses OpenAI (GPT-4o-mini) to classify messages and extract task entities (assignee, deadline, priority, status), persists them to PostgreSQL, and responds with task confirmations, nudges, and reports.

## Tech Stack

- **Runtime**: Node.js 22, TypeScript (strict, ESM, NodeNext resolution)
- **Bot**: grammY (Telegram, long-polling in dev)
- **HTTP**: Hono + @hono/node-server (`/health`, `/ready`)
- **Queue**: BullMQ + Redis 7 (message.ingest, bot.respond queues)
- **AI**: OpenAI SDK with `zodResponseFormat` for structured outputs
- **DB**: PostgreSQL 16 + Drizzle ORM
- **Logging**: pino (structured JSON in prod, pino-pretty in dev)
- **Validation**: Zod for env parsing, AI response schemas, and all type boundaries
- **Testing**: vitest
- **Package Manager**: pnpm

## Commands

```bash
pnpm dev              # Start bot + HTTP server (tsx, long-polling)
pnpm build            # Compile TypeScript
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint
pnpm test             # vitest
pnpm db:generate      # Drizzle Kit: generate migrations
pnpm db:migrate       # Apply migrations to PostgreSQL
docker compose up     # Start PostgreSQL 16 + Redis 7 for local dev
```

## Architecture

The system is a **message pipeline** with 4 stages processed as BullMQ jobs:

```
Telegram group message
  → grammY middleware enqueues to message.ingest queue
  → Worker Stage 1: classifyMessage() — GPT-4o-mini categorizes (task_creation, status_update, deadline_mention, task_question, general_discussion, bot_command)
  → Worker Stage 2: extractEntities() — GPT-4o-mini extracts assignee, title, deadline, status, priority
  → Worker Stage 3: Persist — findOrCreateTeam/Member, save message, create/update tasks + events
  → Worker Stage 4: decideResponse() — enqueue to bot.respond queue if bot should reply
  → bot.respond worker sends Telegram message (rate-limited: 1 msg/sec per chat)
```

General discussion messages with confidence > 0.8 exit after Stage 1 (skip extraction).

### Source Layout

```
src/
  index.ts                  # Entry point — starts bot + HTTP server + workers
  env.ts                    # Zod-validated environment variables
  bot/
    bot.ts                  # grammY instance + middleware registration
    commands/               # /ping, /tasks, /mytasks, /status, /help
    middleware/              # group-message.ts (captures + enqueues)
  ai/
    client.ts               # OpenAI singleton
    classifier.ts           # classifyMessage()
    extractor.ts            # extractEntities()
    responder.ts            # decideResponse()
    summarizer.ts           # generateStandup(), generateWeeklyReport()
    schemas.ts              # Zod schemas for all AI structured outputs
    prompts/                # System prompts as .md files (classifier, extractor, responder, summarizer)
  db/
    client.ts               # Drizzle client + connection pool
    schema/                 # Tables: teams, members, tasks, task_events, messages, daily_summaries
    queries/                # Query functions per entity
    migrate.ts              # Run migrations on startup (dev only)
  queue/
    connection.ts           # IORedis connection for BullMQ
    queues.ts               # Named queue instances
    types.ts                # Job payload types
  worker/
    message-ingest.worker.ts  # Main pipeline worker
    bot-respond.worker.ts     # Telegram message sender
  scheduler/                # BullMQ repeatable jobs (standup, nudge, weekly report)
  lib/
    logger.ts               # pino logger
    errors.ts               # Custom error classes (AIError, DatabaseError, QueueError)
    shutdown.ts             # Graceful shutdown orchestration
    telegram-format.ts      # HTML formatting for Telegram messages
```

### Key Design Decisions

- **System prompts live in `.md` files** (`src/ai/prompts/`) so they can be iterated without code changes.
- **Auto-registration**: teams and members are created on first message (no manual setup).
- **Idempotency**: messages table has unique constraint on `(team_id, telegram_message_id)` to prevent duplicate processing on BullMQ retry.
- **`chrono-node`** parses natural language dates ("by Friday", "next Monday") into Date objects.
- **Assignee matching**: fuzzy match normalized names against `display_name` and `username` in members table.
- **Task matching**: keyword overlap search in task titles within same team.
- **AI confidence threshold**: bot only responds when confidence > 0.7; defaults to silent otherwise.

## Build Phases

The project is built incrementally across 6 phases documented in `phases/`:

1. **Foundation** — Bot scaffolding, grammY, Hono, Docker Compose
2. **AI Pipeline** — BullMQ + OpenAI classify/extract pipeline
3. **Persistence** — Drizzle ORM, PostgreSQL schema, task CRUD
4. **Active PM** — Bot responses, slash commands, clarification requests
5. **Scheduled** — Daily standups, overdue nudges, weekly reports (BullMQ repeatable jobs)
6. **Polish** — Error handling, graceful shutdown, Docker prod build, CI

## Environment

Requires `.env` file (see `.env.example`). Key variables:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `OPENAI_API_KEY`
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string

**Telegram note**: Bot privacy mode must be disabled via @BotFather (`/setprivacy` → Disable) for the bot to see all group messages, not just `/commands`.
