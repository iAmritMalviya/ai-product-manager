import { pgTable, uuid, bigint, text, timestamp, unique } from "drizzle-orm/pg-core";
import { teams } from "./teams.js";

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id),
    telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull(),
    displayName: text("display_name").notNull(),
    username: text("username"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_team_member").on(table.teamId, table.telegramUserId),
  ]
);
