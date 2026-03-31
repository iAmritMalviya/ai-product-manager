import { pgTable, pgEnum, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { teams } from "./teams.js";
import { members } from "./members.js";

export const taskStatusEnum = pgEnum("task_status", [
  "proposed",
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  title: text("title").notNull(),
  assigneeId: uuid("assignee_id").references(() => members.id),
  status: taskStatusEnum("status").notNull().default("proposed"),
  priority: taskPriorityEnum("priority"),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
