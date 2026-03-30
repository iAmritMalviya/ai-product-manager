# Phase 3: Persistence

**Status:** Not Started
**Depends on:** Phase 2 (AI pipeline extracts entities)
**Delivers:** All extracted data persisted to PostgreSQL, members auto-registered, tasks tracked

---

## What Gets Built

1. **Drizzle ORM setup** — client, connection, migration config
2. **Database schema** — all 6 tables: teams, members, tasks, task_events, messages, daily_summaries
3. **Migrations** — generated and applied via Drizzle Kit
4. **Auto-registration** — teams created on first message from a group, members created on first message from a user
5. **Task CRUD queries** — create, update status, assign, set deadline, find by team/assignee/status
6. **Message logging** — every processed message saved with classification result
7. **Task event audit trail** — every status change, assignment, deadline change logged
8. **Worker update** — message-ingest worker now persists to DB after extraction

## Key Files

| File | Purpose |
|------|---------|
| `src/db/client.ts` | Drizzle client + connection pool |
| `src/db/schema/teams.ts` | Teams table definition |
| `src/db/schema/members.ts` | Members table definition |
| `src/db/schema/tasks.ts` | Tasks table + status/priority enums |
| `src/db/schema/task-events.ts` | Task events (audit trail) |
| `src/db/schema/messages.ts` | Messages table + classification enum |
| `src/db/schema/daily-summaries.ts` | Daily summaries table |
| `src/db/schema/index.ts` | Re-exports all schemas |
| `src/db/queries/teams.ts` | findOrCreateTeam(chatId, name) |
| `src/db/queries/members.ts` | findOrCreateMember(teamId, userId, name, username) |
| `src/db/queries/tasks.ts` | createTask, updateStatus, assignTask, getTasksByTeam, getTasksByAssignee, getOverdueTasks |
| `src/db/queries/messages.ts` | saveMessage, getRecentMessages(chatId, limit) |
| `src/db/migrate.ts` | Run migrations on startup |
| `drizzle.config.ts` | Drizzle Kit config |

## Schema Details

### Enums
```typescript
// Task status lifecycle
const taskStatusEnum = pgEnum("task_status", [
  "proposed",     // AI detected but unconfirmed
  "open",         // Confirmed, not started
  "in_progress",  // Being worked on
  "blocked",      // Stuck
  "done",         // Completed
  "cancelled"     // Dropped
]);

const taskPriorityEnum = pgEnum("task_priority", [
  "low", "medium", "high", "urgent"
]);

const messageClassificationEnum = pgEnum("message_classification", [
  "task_creation", "status_update", "deadline_mention",
  "task_question", "general_discussion", "bot_command"
]);

const taskEventTypeEnum = pgEnum("task_event_type", [
  "created", "status_change", "assigned", "unassigned",
  "deadline_set", "deadline_changed", "priority_changed",
  "title_updated", "description_updated"
]);
```

## Updated Worker Pipeline

```
Worker picks up job
    │
    v
Stage 1: classifyMessage()
    │
    v
Stage 2: extractEntities()
    │
    v
Stage 3: Accumulate & Persist
    ├── findOrCreateTeam(chatId)
    ├── findOrCreateMember(teamId, senderId)
    ├── saveMessage(teamId, memberId, text, classification)
    ├── Parse deadline with chrono-node
    ├── Fuzzy-match assignee against members table
    ├── Match referenced tasks by keywords
    │
    ├── If task_creation:
    │   ├── createTask(teamId, title, assignee, deadline, priority)
    │   └── createTaskEvent(taskId, "created")
    │
    ├── If status_update:
    │   ├── Find matching task
    │   ├── updateTaskStatus(taskId, newStatus)
    │   └── createTaskEvent(taskId, "status_change", oldStatus, newStatus)
    │
    └── If deadline_mention:
        ├── Find matching task
        ├── updateTaskDeadline(taskId, newDeadline)
        └── createTaskEvent(taskId, "deadline_changed")
```

## New Dependencies

```
drizzle-orm
drizzle-kit (dev)
postgres (pg driver — use 'postgres' package, not 'pg')
chrono-node
```

## Idempotency

- Messages table has unique constraint on `(team_id, telegram_message_id)`
- Worker checks for existing message before processing
- Prevents duplicate task creation on BullMQ retry

## Definition of Done

- [ ] `pnpm db:generate` creates migration files
- [ ] `pnpm db:migrate` applies migrations to PG (or auto-migrate on startup)
- [ ] Send first message in group → team + member auto-created in DB
- [ ] Send "Amrit will finish auth by Friday" → task row created with assignee, deadline, status=proposed
- [ ] Send "auth is done" → task status updated to done, task_event logged
- [ ] `SELECT * FROM tasks WHERE team_id = X` shows correct data
- [ ] `SELECT * FROM messages` shows all processed messages with classifications
- [ ] Duplicate message (same telegram_message_id) is ignored, not double-processed
- [ ] Recent messages query works (used for AI context in Phase 2)

## Notes

- Auto-migrate on startup in dev (`NODE_ENV=development`), explicit migration in prod
- `chrono-node` parses "by Friday", "next Monday", "March 15" → Date objects
- Fuzzy assignee matching: normalize names (lowercase, trim), check `display_name` and `username`
- For task matching: search by keyword overlap in task title within same team
