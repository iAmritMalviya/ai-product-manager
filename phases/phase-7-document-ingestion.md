# Phase 7: Document Ingestion

**Status:** Complete
**Depends on:** Phase 4 (pipeline + bot responses working)
**Delivers:** Bot processes uploaded documents (PDFs, images, spreadsheets, Word docs) — extracts text, feeds into the classify → extract → persist pipeline

---

## What Gets Built

1. **Document middleware** — captures file uploads (photos, documents) in group chats, downloads via Telegram API, enqueues to `document.ingest` queue
2. **Document ingest worker** — processes uploaded files: extract text → feed into existing AI pipeline
3. **Text extraction layer** — extracts readable text from various file types:
   - **Images (PNG, JPG, WEBP)** — AI vision (Gemini/GPT-4o) for OCR + understanding
   - **PDFs** — `pdf-parse` for text-based PDFs, AI vision fallback for scanned/image PDFs
   - **Word docs (.docx)** — `mammoth` for text extraction
   - **Spreadsheets (.xlsx, .csv)** — `xlsx` for structured data → text summary
   - **Plain text (.txt, .md, .json)** — direct read
4. **AI document summarizer** — for large documents, summarize before feeding into classifier (keep within token limits)
5. **Document storage in DB** — track uploaded documents with extracted text, link to messages
6. **Bot acknowledgment** — bot confirms document receipt and what it extracted

## Key Files

| File | Purpose |
|------|---------|
| `src/bot/middleware/document-message.ts` | Captures file uploads, downloads, enqueues to `document.ingest` |
| `src/worker/document-ingest.worker.ts` | Processes uploaded documents through extraction + AI pipeline |
| `src/lib/extractors/index.ts` | Router — picks the right extractor based on MIME type |
| `src/lib/extractors/image.ts` | AI vision extraction for images |
| `src/lib/extractors/pdf.ts` | PDF text extraction with vision fallback |
| `src/lib/extractors/docx.ts` | Word document text extraction |
| `src/lib/extractors/spreadsheet.ts` | Excel/CSV to text summary |
| `src/lib/extractors/plaintext.ts` | Direct text read for txt/md/json |
| `src/db/schema/documents.ts` | Documents table definition |
| `src/db/queries/documents.ts` | Document CRUD queries |
| `src/queue/queues.ts` | Updated: add `document.ingest` queue |
| `src/queue/types.ts` | Updated: add `DocumentIngestPayload` |
| `src/ai/document-summarizer.ts` | Summarize long documents before classification |
| `src/bot/bot.ts` | Updated: register document middleware |

## Queue Payload

```typescript
interface DocumentIngestPayload {
  chatId: number;
  senderId: number;
  senderName: string;
  senderUsername: string | null;
  messageId: number;
  timestamp: number;
  caption: string | null;          // User's caption on the upload
  fileId: string;                  // Telegram file_id for download
  fileName: string | null;         // Original filename if available
  mimeType: string | null;         // MIME type from Telegram
  fileSize: number;                // File size in bytes
}
```

## Pipeline Flow

```
User uploads document/image in group chat
    │
    v
Document middleware captures file metadata
    │
    v
Download file via bot.api.getFile() → fetch file buffer
    │
    v
Enqueue to document.ingest queue
    │
    v
Worker picks up job
    │
    v
Stage 1: Determine file type from MIME type / extension
    │
    ├── Image (png/jpg/webp/gif) → AI vision extraction
    ├── PDF → pdf-parse for text; if <50 chars extracted, fallback to AI vision
    ├── DOCX → mammoth extraction
    ├── XLSX/CSV → xlsx parse → structured text summary
    └── TXT/MD/JSON → direct read
    │
    v
Stage 2: If extracted text > 4000 chars → summarize with AI (keep under token budget)
    │
    v
Stage 3: Save document record to DB (team_id, member_id, file metadata, extracted text)
    │
    v
Stage 4: Feed extracted text (or summary) into existing pipeline:
    ├── classifyMessage(extractedText, senderName, recentContext)
    ├── If task-related → extractEntities()
    ├── Persist tasks/status updates/deadlines
    └── decideResponse() → enqueue bot reply
    │
    v
Stage 5: Bot responds with document acknowledgment
    e.g., "Got it — processed <b>meeting-notes.pdf</b>. Tracked 2 new tasks."
```

## Database Schema

### Documents Table
```typescript
const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  memberId: uuid("member_id").notNull().references(() => members.id),
  messageId: uuid("message_id").references(() => messages.id),
  telegramFileId: text("telegram_file_id").notNull(),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size").notNull(),
  extractedText: text("extracted_text"),
  summary: text("summary"),                  // AI summary for large docs
  extractionMethod: text("extraction_method"), // "vision", "pdf-parse", "mammoth", etc.
  tasksExtracted: integer("tasks_extracted").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## Extraction Strategies

### Images (AI Vision)
- Send image buffer directly to Gemini/GPT-4o vision API
- Prompt: "Extract all text content from this image. If it contains task-related information (assignments, deadlines, status updates, meeting notes), structure that clearly. Return the raw extracted text."
- Works for: screenshots of Trello/Jira boards, whiteboard photos, handwritten notes, chat screenshots

### PDFs
- **Primary**: `pdf-parse` — fast, no API cost, works for text-based PDFs
- **Fallback**: If `pdf-parse` returns <50 chars (scanned PDF), convert pages to images → AI vision
- Use `pdf-parse` first, check extracted text length, fallback if empty
- For multi-page PDFs: extract all pages, concatenate, then summarize if too long

### Word Documents (.docx)
- `mammoth` library — extracts text + basic formatting from .docx files
- Strips formatting, returns plain text
- Handles tables, lists, headings

### Spreadsheets (.xlsx, .csv)
- `xlsx` library — parse into JSON rows
- Convert to readable text: "Sheet: Tasks | Row 1: Task=Auth module, Assignee=Amrit, Status=In Progress, Deadline=April 10"
- Cap at first 100 rows to avoid token explosion

### Plain Text
- Direct `Buffer.toString("utf-8")`
- Applies to .txt, .md, .json, .log files

## AI Document Summarizer

For documents with extracted text > 4000 characters:

```typescript
async function summarizeDocument(
  text: string,
  fileName: string | null
): Promise<string>
```

System prompt: "Summarize this document focusing on task-related content: assignments, deadlines, status updates, action items, decisions. Keep the summary under 1000 words. Preserve names, dates, and specific commitments."

## File Size Limits

| Type | Max Size | Reason |
|------|----------|--------|
| Images | 10 MB | Telegram's photo limit |
| Documents | 20 MB | Telegram's document limit |
| Reject if larger | — | Log warning, don't crash |

## Supported MIME Types

```typescript
const SUPPORTED_TYPES: Record<string, string> = {
  // Images
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",

  // Documents
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "text/csv": "spreadsheet",
  "text/plain": "plaintext",
  "text/markdown": "plaintext",
  "application/json": "plaintext",
};
```

## New Dependencies

```
pdf-parse          # PDF text extraction
mammoth            # DOCX to text
xlsx               # Excel/CSV parsing
```

No new dep for images — uses existing Gemini/OpenAI vision API via the AI provider abstraction.

## Middleware: Document Capture

```typescript
// Handles both ctx.message.photo (compressed images) and ctx.message.document (files)
// Photos: Telegram sends multiple sizes, pick the largest (last in array)
// Documents: have file_name, mime_type directly on the object

if (ctx.message?.photo || ctx.message?.document) {
  // Get file metadata
  // Download via bot.api.getFile(fileId) → fetch URL
  // Enqueue to document.ingest queue
}
```

## Definition of Done

- [ ] Upload a PDF with meeting notes → bot extracts text, creates tasks mentioned in the doc
- [ ] Upload a screenshot of a task board → bot reads via vision, logs tasks it sees
- [ ] Upload a .docx project plan → bot extracts text, identifies deadlines and assignments
- [ ] Upload an Excel with task list → bot parses rows, creates corresponding tasks
- [ ] Upload a plain text file → bot reads and classifies content
- [ ] Upload an image of handwritten notes → bot OCRs and extracts tasks
- [ ] Large document (>4000 chars) → summarized before classification, no token explosion
- [ ] Unsupported file type → bot replies "I can't process this file type yet"
- [ ] File too large → bot replies with size limit info
- [ ] Document record saved to DB with extracted text and metadata
- [ ] Duplicate file upload (same message ID) → idempotent, not reprocessed
- [ ] Caption on upload is included as additional context for classification
- [ ] Bot responds with what it found: "Processed meeting-notes.pdf — tracked 2 new tasks"
- [ ] `pnpm typecheck` passes with zero errors

## Notes

- **AI vision is the Swiss army knife** — when text extraction fails or returns garbage, fall back to vision. It handles screenshots, scanned docs, photos of whiteboards, and handwritten notes.
- **Caption is valuable context** — if someone uploads a PDF with caption "here are the tasks from today's meeting", that context should influence classification. Pass caption alongside extracted text.
- **Don't re-extract on retry** — if the document record exists in DB with extracted text, skip extraction on BullMQ retry. Only re-run AI classification.
- **Token budget** — Gemini 2.0 Flash handles ~1M tokens, GPT-4o-mini handles ~128K. Even large documents after summarization fit easily. The 4000-char summarization threshold is conservative.
- **Telegram file download** — `bot.api.getFile(fileId)` returns a file path, then fetch from `https://api.telegram.org/file/bot<token>/<file_path>`. File URLs expire, so download immediately in the middleware before enqueueing (pass the buffer, not the URL).
- **Photos vs Documents** — Telegram compresses photos uploaded as photos. Documents uploaded "as file" keep original quality. Handle both paths.
