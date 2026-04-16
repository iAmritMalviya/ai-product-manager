import { pgTable, uuid, bigint, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { teams } from "./teams.js";
import { members } from "./members.js";
import { messages } from "./messages.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    messageId: uuid("message_id").references(() => messages.id),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }).notNull(),
    telegramFileId: text("telegram_file_id").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size").notNull(),
    extractedText: text("extracted_text"),
    summary: text("summary"),
    extractionMethod: text("extraction_method"),
    tasksExtracted: integer("tasks_extracted").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_team_document").on(table.teamId, table.telegramMessageId),
  ]
);
