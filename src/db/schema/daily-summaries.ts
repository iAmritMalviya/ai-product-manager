import { pgTable, pgEnum, uuid, text, date, timestamp, unique } from "drizzle-orm/pg-core";
import { teams } from "./teams.js";

export const summaryTypeEnum = pgEnum("summary_type", [
  "daily_standup",
  "overdue_nudge",
  "weekly_report",
]);

export const dailySummaries = pgTable(
  "daily_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id),
    summaryDate: date("summary_date").notNull(),
    summaryType: summaryTypeEnum("summary_type").notNull().default("daily_standup"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_team_summary_date_type").on(table.teamId, table.summaryDate, table.summaryType),
  ]
);
