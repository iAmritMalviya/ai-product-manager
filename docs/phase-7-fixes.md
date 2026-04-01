# Phase 7: Document Ingestion — Review Fixes

Findings from senior engineering review of `phases/phase-7-document-ingestion.md`.
These must be addressed before or during implementation.

---

## P0 — Blocking (fix before implementation starts)

### 1. Don't pass file buffers through Redis

**Problem:** BullMQ serializes payloads to JSON. A 20MB PDF becomes ~27MB after Base64 encoding. 5 concurrent uploads = 135MB in Redis, stalling the entire message pipeline (`message.ingest` + `bot.respond` share the same Redis).

**Fix:**
- Middleware: download file to a temp directory on disk, store only the file path in the job payload
- Worker: read from disk, process, delete temp file
- Add `filePath: string` to `DocumentIngestPayload` instead of passing a buffer
- Add `TEMP_FILE_DIR` env var (default: `os.tmpdir()`)

**Files affected:** `src/bot/middleware/document-message.ts`, `src/queue/types.ts`, `src/worker/document-ingest.worker.ts`, `src/env.ts`

---

### 2. AI provider interface has no vision support

**Problem:** `AIProvider` interface (`src/ai/providers/types.ts`) only accepts `content: string` in `ChatMessage`. No way to pass image data. All image OCR and scanned PDF fallback paths will fail at runtime.

**Fix:** Add a vision method to the `AIProvider` interface:
```typescript
// src/ai/providers/types.ts
visionExtract(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<string>;
```

Implement in Gemini provider using `inlineData` in `Part[]`. Keep separate from `chatWithStructuredOutput` — different cost profile, different error handling.

**Files affected:** `src/ai/providers/types.ts`, `src/ai/providers/gemini.ts`, `src/ai/providers/openai.ts` (when implemented), `src/lib/extractors/image.ts`

---

### 3. `messages.text` is NOT NULL — documents without text will crash

**Problem:** `src/db/schema/messages.ts` has `text: text("text").notNull()`. Documents with no caption and failed extraction can't create a message row.

**Fix:** Don't store extracted content in the messages table. Instead:
- Message row gets the caption as text, or a placeholder: `"[Document: meeting-notes.pdf]"`
- Extracted text lives only in the `documents` table (`extracted_text` column)
- This keeps the messages table clean for chat messages

**Files affected:** `src/worker/document-ingest.worker.ts`, `src/db/queries/documents.ts`

---

### 4. Payload missing file path field

**Problem:** `DocumentIngestPayload` has `fileId` (Telegram's remote reference) but no local file path. Telegram download URLs expire, so the worker can't re-download later.

**Fix:** Add `filePath: string` to the payload. Middleware downloads and saves to temp disk before enqueuing.

**Files affected:** `src/queue/types.ts`

---

## P1 — Significant (fix during implementation)

### 5. No PDF-to-image library for scanned PDF vision fallback

**Problem:** `pdf-parse` returns text, not images. To do vision fallback on scanned PDFs, you need to render pages as images. No library listed in dependencies.

**Fix:**
- Add `pdf-to-img` (or `@vercel/pdf`) to dependencies
- Cap vision fallback at 10 pages via `MAX_VISION_PAGES` env var
- Log a warning when falling back to vision with page count
- 50-page uncapped = $0.125 (Gemini) to $1.50 (GPT-4o) per document

**Files affected:** `package.json`, `src/lib/extractors/pdf.ts`, `src/env.ts`

---

### 6. Classifier can't handle multi-action documents

**Problem:** A meeting notes PDF with 5 tasks, 2 status updates, and a deadline gets classified into ONE category. The extractor then pulls entities for that single category. Result: 1 task created instead of 5.

**Fix:** Add a document pre-processing step before classification:
- New function `splitDocumentIntoActions(text: string): Promise<string[]>` that uses AI to split a document into individual action items
- Each action item is then classified and extracted independently through the existing pipeline
- The summarizer prompt should instruct: "Output each action item as a separate numbered entry"

Alternative: Add `classifyDocument()` that returns `Array<{category, textSegment, confidence}>` instead of a single classification.

**Files affected:** New file `src/ai/document-splitter.ts`, `src/worker/document-ingest.worker.ts`

---

### 7. No `document_processed` response type

**Problem:** Responder schema (`src/ai/schemas.ts`) has no type for document processing results. The desired response "Processed meeting-notes.pdf — tracked 3 tasks" doesn't fit `confirm_task` (single task only).

**Fix:**
- Add `"document_processed"` to `responseDecisionSchema.responseType` enum
- Add document handling rules to responder system prompt
- Consider adding `"document_upload"` to `messageClassificationEnum` in `src/db/schema/messages.ts`

**Files affected:** `src/ai/schemas.ts`, `src/ai/responder.ts`, `src/db/schema/messages.ts`

---

### 8. Caption not captured in conversation context

**Problem:** Telegram puts captions in `ctx.message.caption`, not `ctx.message.text`. The existing `groupMessageMiddleware` checks `ctx.message?.text` and won't capture document captions. Captions disappear from the 50-message context window.

**Fix:** In the document middleware, if `ctx.message.caption` exists, also enqueue a regular `MessageIngestPayload` for the caption text. This way "see the doc I just uploaded" appears in conversation history for future context.

**Files affected:** `src/bot/middleware/document-message.ts`

---

### 9. No unique constraint on documents table

**Problem:** Documents table schema has no idempotency constraint. BullMQ retries will create duplicate document records.

**Fix:** Add `unique("uq_team_document").on(table.teamId, table.telegramMessageId)` to the documents schema. Use `onConflictDoNothing` in the insert query (same pattern as `saveMessage`).

Note: use `telegramMessageId`, not `telegramFileId` — the same file forwarded to different groups should create separate records.

**Files affected:** `src/db/schema/documents.ts`, `src/db/queries/documents.ts`

---

### 10. No file content validation — security risk

**Problem:**
- MIME type from Telegram is user-controlled. A `.exe` renamed to `.pdf` passes through.
- `pdf-parse` executes embedded JavaScript in PDFs by default (based on `pdfjs-dist`).
- `xlsx` processes XML — vulnerable to billion laughs attack (XML entity expansion).
- Extracted text goes directly into AI prompts — prompt injection risk.

**Fix:**
- Add `file-type` npm package for magic byte validation
- Create `validateFile(buffer, claimedMimeType): {valid, actualMimeType}` helper
- Use `pdf-parse` with `{ max: 0 }` or use `pdfjs-dist` directly with `isEvalSupported: false`
- Use `xlsx` with `{ type: 'buffer', WTF: false }`
- Sanitize all extracted text before AI prompts (same as `sanitizeMessageText` but for longer content)

**Files affected:** `package.json` (add `file-type`), new file `src/lib/extractors/validate.ts`, all extractor files

---

### 11. Memory exhaustion at concurrency 5

**Problem:** If document worker inherits concurrency 5 from the message worker pattern, 5 concurrent 20MB files = 100MB in buffers + extracted text + AI overhead. Will OOM on constrained containers.

**Fix:** Set document worker concurrency to `1` or `2`. Document processing is IO-bound (AI vision calls), not CPU-bound.

```typescript
{ connection: createRedisConnection(), concurrency: 2 }
```

**Files affected:** `src/worker/document-ingest.worker.ts`

---

## P2 — Design Improvements (fix during or after implementation)

### 12. Temp file cleanup on worker failure

**Problem:** If worker crashes between download and cleanup, orphaned temp files accumulate.

**Fix:** Wrap worker processing in `try/finally` to always delete temp file. Add a periodic cleanup (`setInterval` in `index.ts`) for files older than 1 hour.

---

### 13. Summarization threshold too low (4000 chars)

**Problem:** 4000 chars ≈ 600 tokens. Both Gemini (1M context) and GPT-4o-mini (128K context) handle this trivially. The extra summarization API call adds latency, cost, and loses information (names, dates, assignments).

**Fix:** Raise threshold to **16,000 chars** (~3,000 tokens). Only summarize genuinely long documents (20+ page contracts). Most meeting notes and task lists fit under 16K.

---

### 14. Document queue needs custom job options

**Problem:** Default BullMQ job options (3 retries, 2s backoff) are wrong for documents — vision calls are expensive and slow.

**Fix:**
```typescript
{
  attempts: 2,                              // fewer retries (expensive)
  backoff: { type: "exponential", delay: 5000 }, // longer initial delay
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 604800 },
  timeout: 120_000,                         // 2min (vision calls are slow)
}
```

---

### 15. Missing environment variables

Add to `src/env.ts`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAX_DOCUMENT_SIZE_MB` | `20` | Reject files larger than this |
| `MAX_VISION_PAGES` | `10` | Cap expensive vision fallback for scanned PDFs |
| `DOCUMENT_SUMMARIZATION_THRESHOLD` | `16000` | Chars before triggering summarization |
| `TEMP_FILE_DIR` | `os.tmpdir()` | Where to store downloaded files |

---

### 16. No `/documents` command

Users have no way to see what documents were processed. Add as follow-up:
- `/documents` — list recent documents for this group
- `/document <id>` — show extraction results for a specific document

Not blocking for Phase 7, but should be tracked.

---

## Cost Reference

| Operation | Gemini 2.0 Flash | GPT-4o |
|-----------|------------------|--------|
| Single image vision | ~$0.0025 | ~$0.01–0.03 |
| 10-page scanned PDF | ~$0.025 | ~$0.10–0.30 |
| 50-page scanned PDF (uncapped) | ~$0.125 | ~$0.50–1.50 |
| Text classification | ~$0.0001 | ~$0.0003 |
| Document summarization | ~$0.0003 | ~$0.001 |

**Recommendation:** Add cost-awareness logging after each vision call. Consider a per-team daily cost cap (configurable via env) — stop processing and reply with "Document processing limit reached for today" when hit.
