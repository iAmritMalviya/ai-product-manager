import { and, eq, lt, not, inArray } from "drizzle-orm";
import { db } from "../client.js";
import { tasks, taskEvents } from "../schema/index.js";

export async function createTask(data: {
  teamId: string;
  title: string;
  assigneeId?: string | null;
  status?: "proposed" | "open" | "in_progress" | "blocked" | "done" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent" | null;
  deadline?: Date | null;
  triggeredById?: string | null;
}) {
  const [task] = await db
    .insert(tasks)
    .values({
      teamId: data.teamId,
      title: data.title,
      assigneeId: data.assigneeId ?? null,
      status: data.status ?? "proposed",
      priority: data.priority ?? null,
      deadline: data.deadline ?? null,
    })
    .returning();

  await db.insert(taskEvents).values({
    taskId: task.id,
    type: "created",
    newValue: task.status,
    triggeredById: data.triggeredById ?? null,
  });

  return task;
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: "proposed" | "open" | "in_progress" | "blocked" | "done" | "cancelled",
  triggeredById?: string
) {
  const existing = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!existing) return null;

  const [updated] = await db
    .update(tasks)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  await db.insert(taskEvents).values({
    taskId,
    type: "status_change",
    oldValue: existing.status,
    newValue: newStatus,
    triggeredById: triggeredById ?? null,
  });

  return updated;
}

export async function updateTaskDeadline(
  taskId: string,
  newDeadline: Date,
  triggeredById?: string
) {
  const existing = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!existing) return null;

  const [updated] = await db
    .update(tasks)
    .set({ deadline: newDeadline, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  await db.insert(taskEvents).values({
    taskId,
    type: existing.deadline ? "deadline_changed" : "deadline_set",
    oldValue: existing.deadline?.toISOString() ?? null,
    newValue: newDeadline.toISOString(),
    triggeredById: triggeredById ?? null,
  });

  return updated;
}

export async function assignTask(
  taskId: string,
  assigneeId: string,
  triggeredById?: string
) {
  const existing = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!existing) return null;

  const [updated] = await db
    .update(tasks)
    .set({ assigneeId, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  await db.insert(taskEvents).values({
    taskId,
    type: "assigned",
    oldValue: existing.assigneeId,
    newValue: assigneeId,
    triggeredById: triggeredById ?? null,
  });

  return updated;
}

export async function getTasksByTeam(teamId: string) {
  return db.query.tasks.findMany({
    where: and(
      eq(tasks.teamId, teamId),
      not(inArray(tasks.status, ["done", "cancelled"]))
    ),
  });
}

export async function getTasksByAssignee(assigneeId: string) {
  return db.query.tasks.findMany({
    where: and(
      eq(tasks.assigneeId, assigneeId),
      not(inArray(tasks.status, ["done", "cancelled"]))
    ),
  });
}

export async function getOverdueTasks(teamId: string) {
  return db.query.tasks.findMany({
    where: and(
      eq(tasks.teamId, teamId),
      not(inArray(tasks.status, ["done", "cancelled"])),
      lt(tasks.deadline, new Date())
    ),
  });
}

export async function findTaskByKeywords(teamId: string, keywords: string[]) {
  if (keywords.length === 0) return null;

  const teamTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.teamId, teamId),
      not(inArray(tasks.status, ["done", "cancelled"]))
    ),
  });

  const normalizedKeywords = keywords.map((k) => k.toLowerCase());
  const minScore = Math.max(1, Math.ceil(normalizedKeywords.length / 2));

  let bestMatch: (typeof teamTasks)[number] | null = null;
  let bestScore = 0;

  for (const task of teamTasks) {
    const titleWords = task.title.toLowerCase().split(/\s+/);
    const score = normalizedKeywords.filter((kw) =>
      titleWords.some((tw) => tw.includes(kw) || kw.includes(tw))
    ).length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = task;
    }
  }

  return bestScore >= minScore ? bestMatch : null;
}
