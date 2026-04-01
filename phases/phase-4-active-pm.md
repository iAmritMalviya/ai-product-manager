# Phase 4: Active PM

**Status:** Complete
**Depends on:** Phase 3 (tasks persisted to DB)
**Delivers:** Bot responds in chat — confirms tasks, asks clarifications, supports slash commands

---

## What Gets Built

1. **Response decision AI** — GPT-4o-mini decides if/what to respond after each extraction
2. **Bot respond worker** — dequeues response jobs, sends messages to Telegram with rate limiting
3. **Task confirmation** — "Got it — tracked: *Auth module* assigned to @amrit, due Friday"
4. **Clarification requests** — "Sounds like a task, but who's handling it?" / "Any deadline for this?"
5. **Status acknowledgment** — "Noted — *Auth module* marked as done"
6. **Slash commands:**
   - `/tasks` — list all active tasks for the group
   - `/mytasks` — list tasks assigned to the sender
   - `/status <task>` — show status of a specific task
   - `/help` — list available commands
7. **Telegram message formatting** — HTML/MarkdownV2 formatted responses

## Key Files

| File | Purpose |
|------|---------|
| `src/ai/responder.ts` | `decideResponse(extraction, context)` → ResponseDecision |
| `src/ai/schemas.ts` | Add ResponseDecision schema |
| `src/ai/prompts/responder.md` | System prompt for response decisions |
| `src/worker/bot-respond.worker.ts` | Dequeue + send via bot.api.sendMessage() |
| `src/worker/message-ingest.worker.ts` | Updated: Stage 4 → enqueue response |
| `src/bot/commands/tasks.ts` | `/tasks` — all active tasks |
| `src/bot/commands/mytasks.ts` | `/mytasks` — sender's tasks |
| `src/bot/commands/status.ts` | `/status <keyword>` — task status |
| `src/bot/commands/help.ts` | `/help` — command list |
| `src/lib/telegram-format.ts` | Format task lists, confirmations in HTML |

## Response Decision Schema

```typescript
z.object({
  shouldRespond: z.boolean(),
  responseType: z.enum([
    "confirm_task",      // New task detected and tracked
    "ack_status",        // Status update acknowledged
    "clarify_assignee",  // Task detected but no assignee
    "clarify_deadline",  // Task detected but no deadline
    "clarify_ambiguous", // Message might be a task, unclear
    "silent"             // Nothing to say
  ]),
  message: z.string().nullable(),  // The actual response text
  confidence: z.number().min(0).max(1)
})
```

## Response Examples

**Task Creation Confirmed:**
> New task tracked:
> **Auth module** — assigned to @amrit
> Deadline: Friday, Apr 4
> Priority: Medium
>
> React with to confirm or to dismiss.

**Status Update:**
> Updated: **Auth module** is now done
> Completed by @amrit

**Clarification:**
> Sounds like a new task: **Refactor payment flow**
> Who's taking this? Reply or I'll leave it unassigned.

**Command — /tasks:**
> **Active Tasks (3)**
>
> 1. **Auth module** — @amrit — In Progress — Due Apr 4
> 2. **Payment bug** — @ravi — Open — No deadline
> 3. **Landing page** — Unassigned — Proposed
>
> Use `/mytasks` to see only yours.

## Updated Worker Pipeline (Full)

```
Worker picks up message.ingest job
    │
    v
Stage 1: classify
Stage 2: extract
Stage 3: accumulate & persist (Phase 3)
    │
    v
Stage 4: decideResponse(extraction, recentMessages)
    │
    ├── shouldRespond: false → done
    │
    └── shouldRespond: true
        │
        v
    Enqueue to bot.respond queue
    payload: { chatId, text, replyToMessageId, parseMode: "HTML" }
```

## Rate Limiting

- Telegram API limit: 30 messages/second globally, 1 message/second per chat
- bot.respond worker processes sequentially per chat
- Use BullMQ rate limiter: `limiter: { max: 1, duration: 1100 }` (per chat group key)

## Definition of Done

- [x] Send "Amrit will finish auth by Friday" → bot replies with task confirmation
- [x] Send "auth is done" → bot replies with status acknowledgment
- [x] Send "we need to refactor payments" (no assignee) → bot asks who's handling it
- [x] Send "nice weather" → bot stays silent
- [x] `/tasks` → lists all active tasks formatted nicely
- [x] `/mytasks` → shows only sender's tasks
- [x] `/status auth` → shows auth module task details
- [x] `/help` → lists all commands
- [x] Bot doesn't spam — stays silent on casual chat
- [x] Responses are formatted cleanly in Telegram (HTML)
- [x] Rate limiting prevents Telegram API throttling

## Notes

- Reply to the original message (replyToMessageId) for context
- Keep bot responses concise — no one likes a chatty bot
- Confidence threshold: only respond when confidence > 0.7
- If AI returns low confidence, default to silent
- System prompt should emphasize: "You are a concise PM assistant. Only speak when you add value."
