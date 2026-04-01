import { pgTable, uuid, text, date, timestamp, unique } from "drizzle-orm/pg-core";
import { teams } from "./teams.js";

export const dailySummaries = pgTable(
  "daily_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id),
    summaryDate: date("summary_date").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_team_summary_date").on(table.teamId, table.summaryDate),
  ]
);
