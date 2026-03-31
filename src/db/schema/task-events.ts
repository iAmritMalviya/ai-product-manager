import { pgTable, pgEnum, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.js";
import { members } from "./members.js";

export const taskEventTypeEnum = pgEnum("task_event_type", [
  "created",
  "status_change",
  "assigned",
  "unassigned",
  "deadline_set",
  "deadline_changed",
  "priority_changed",
  "title_updated",
  "description_updated",
]);

export const taskEvents = pgTable("task_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  type: taskEventTypeEnum("type").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  triggeredById: uuid("triggered_by_id").references(() => members.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
