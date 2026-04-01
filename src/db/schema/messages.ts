import { pgTable, pgEnum, uuid, bigint, text, real, timestamp, unique } from "drizzle-orm/pg-core";
import { teams } from "./teams.js";
import { members } from "./members.js";

export const messageClassificationEnum = pgEnum("message_classification", [
  "task_creation",
  "status_update",
  "deadline_mention",
  "task_question",
  "general_discussion",
  "bot_command",
]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }).notNull(),
    text: text("text").notNull(),
    classification: messageClassificationEnum("classification"),
    classificationConfidence: real("classification_confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_team_message").on(table.teamId, table.telegramMessageId),
  ]
);
