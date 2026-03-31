# Phase 2: AI Pipeline

**Status:** Complete
**Depends on:** Phase 1 (bot captures messages)
**Delivers:** Messages flow through BullMQ → OpenAI classifies and extracts task entities

---

## What Gets Built

1. **BullMQ queue setup** — Redis connection, `message.ingest` queue, `bot.respond` queue
2. **Group message middleware update** — enqueues messages to `message.ingest` instead of just logging
3. **AI client** — OpenAI singleton with structured outputs via Zod schemas
4. **Classifier** — GPT-4o-mini classifies messages: task_creation, status_update, deadline_mention, task_question, general_discussion, bot_command
5. **Extractor** — GPT-4o-mini extracts entities: assignee, task title, deadline, status, priority
6. **Message ingest worker** — dequeues messages, runs classify → extract pipeline, logs results
7. **Zod schemas** — type-safe structured output schemas for all AI responses
8. **System prompts** — Markdown files for classifier, extractor

## Key Files

| File | Purpose |
|------|---------|
| `src/queue/connection.ts` | Redis/IORedis connection for BullMQ |
| `src/queue/queues.ts` | Named queue instances (message.ingest, bot.respond) |
| `src/queue/types.ts` | TypeScript types for job payloads |
| `src/ai/client.ts` | OpenAI client singleton |
| `src/ai/schemas.ts` | Zod schemas: ClassificationResult, ExtractionResult |
| `src/ai/classifier.ts` | `classifyMessage(text, sender)` → ClassificationResult |
| `src/ai/extractor.ts` | `extractEntities(text, classification, context)` → ExtractionResult |
| `src/ai/prompts/classifier.md` | System prompt for classification |
| `src/ai/prompts/extractor.md` | System prompt for extraction |
| `src/worker/message-ingest.worker.ts` | BullMQ worker: classify → extract → log |
| `src/bot/middleware/group-message.ts` | Updated: enqueue to BullMQ |

## AI Schemas

### ClassificationResult
```typescript
z.object({
  category: z.enum([
    "task_creation",
    "status_update",
    "deadline_mention",
    "task_question",
    "general_discussion",
    "bot_command"
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()  // short explanation for debugging
})
```

### ExtractionResult
```typescript
z.object({
  assignee: z.string().nullable(),
  taskTitle: z.string().nullable(),
  deadline: z.string().nullable(),       // natural language, parsed later
  status: z.enum(["proposed", "open", "in_progress", "blocked", "done", "cancelled"]).nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable(),
  referencedTaskKeywords: z.array(z.string()),
  confidence: z.number().min(0).max(1)
})
```

## Pipeline Flow

```
Group message arrives
    │
    v
Enqueue to message.ingest (payload: chatId, senderId, senderName, text, messageId, timestamp)
    │
    v
Worker picks up job
    │
    v
Stage 1: classifyMessage(text, senderName)
    │
    ├── general_discussion + confidence > 0.8 → EXIT (skip extraction)
    │
    v
Stage 2: extractEntities(text, classification, recentMessages[])
    │
    v
Log full result to console (no DB yet)
```

## New Dependencies

```
openai
```

## Definition of Done

- [x] Send "Amrit will finish the auth module by Friday" in group
- [x] Worker logs classification: `task_creation` with high confidence
- [x] Worker logs extraction: `{ assignee: "Amrit", taskTitle: "auth module", deadline: "Friday", status: "proposed" }`
- [x] Send "nice weather today" → classified as `general_discussion`, extraction skipped
- [x] Send "the payment bug is fixed" → classified as `status_update`, extracts status: "done"
- [ ] BullMQ dashboard shows jobs completing (optional: bull-board)
- [x] AI errors are caught and logged, don't crash the worker

## Cost Estimate

- GPT-4o-mini: ~$0.15/1M input tokens, ~$0.60/1M output tokens
- Average message: ~50 tokens input, ~100 tokens output
- Classification + extraction for 200 msgs/day: ~**$0.02/day**
- General discussion early-exit saves ~70% of extraction calls

## Notes

- No database writes yet — all results logged to console for validation
- System prompts are in `.md` files so they can be iterated without code changes
- Context window: pass last 5 messages from same chat for better extraction accuracy
- Use `zodResponseFormat` from OpenAI SDK for structured outputs
