import { getTasksByTeam, getOverdueTasks, getTasksDueToday, getTasksCompletedThisWeek, getTasksCreatedThisWeek } from "../db/queries/tasks.js";
import { getMembersByIds } from "../db/queries/members.js";
import { saveDailySummary, summaryExistsForToday } from "../db/queries/daily-summaries.js";
import { botRespondQueue } from "../queue/queues.js";
import { generateStandup, generateWeeklyReport } from "../ai/summarizer.js";
import { formatOverdueNudge, formatStandupFallback, formatWeeklyFallback } from "../lib/telegram-format.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ module: "scheduler:jobs" });

function todayDateString(timezone: string = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildMemberMap(members: Array<{ id: string; displayName: string }>): Map<string, string> {
  return new Map(members.map((m) => [m.id, m.displayName]));
}

export async function handleDailyStandup(teamId: string, chatId: number, teamName: string, timezone: string) {
  const today = todayDateString(timezone);

  if (await summaryExistsForToday(teamId, today, "daily_standup")) {
    log.info({ teamId }, "Standup already sent today — skipping");
    return;
  }

  const tasks = await getTasksByTeam(teamId);
  if (tasks.length === 0) {
    log.info({ teamId }, "No active tasks — skipping standup");
    return;
  }

  const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))] as string[];
  const members = await getMembersByIds(assigneeIds);
  const memberMap = buildMemberMap(members);

  const tasksData = tasks.map((t) => ({
    title: t.title,
    status: t.status,
    assignee: t.assigneeId ? memberMap.get(t.assigneeId) ?? "Unknown" : "Unassigned",
    deadline: t.deadline?.toISOString() ?? "No deadline",
    priority: t.priority ?? "None",
  }));

  let message: string;
  try {
    const result = await generateStandup(JSON.stringify(tasksData, null, 2));
    message = result.summary;
  } catch (err) {
    log.warn(err, "AI standup generation failed — using fallback formatting");
    const tasksForDisplay = tasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      assigneeName: t.assigneeId ? memberMap.get(t.assigneeId) ?? null : null,
    }));
    message = formatStandupFallback(tasksForDisplay, teamName);
  }

  await botRespondQueue.add("respond", { chatId, text: message, parseMode: "HTML" });
  await saveDailySummary(teamId, today, "daily_standup", message);
  log.info({ teamId }, "Daily standup sent");
}

export async function handleOverdueNudge(teamId: string, chatId: number, timezone: string) {
  const today = todayDateString(timezone);

  if (await summaryExistsForToday(teamId, today, "overdue_nudge")) {
    log.info({ teamId }, "Overdue nudge already sent today — skipping");
    return;
  }

  const tasks = await getOverdueTasks(teamId);
  if (tasks.length === 0) {
    log.info({ teamId }, "No overdue tasks — skipping nudge");
    return;
  }

  const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))] as string[];
  const members = await getMembersByIds(assigneeIds);
  const memberMap = buildMemberMap(members);

  const tasksForDisplay = tasks.map((t) => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    assigneeName: t.assigneeId ? memberMap.get(t.assigneeId) ?? null : null,
  }));

  const message = formatOverdueNudge(tasksForDisplay);
  if (!message) return;

  await botRespondQueue.add("respond", { chatId, text: message, parseMode: "HTML" });
  await saveDailySummary(teamId, today, "overdue_nudge", message);
  log.info({ teamId, overdueCount: tasks.length }, "Overdue nudge sent");
}

export async function handleWeeklyReport(teamId: string, chatId: number, timezone: string) {
  const today = todayDateString(timezone);

  if (await summaryExistsForToday(teamId, today, "weekly_report")) {
    log.info({ teamId }, "Weekly report already sent today — skipping");
    return;
  }

  const [completed, created, active, overdue] = await Promise.all([
    getTasksCompletedThisWeek(teamId),
    getTasksCreatedThisWeek(teamId),
    getTasksByTeam(teamId),
    getOverdueTasks(teamId),
  ]);

  const reportData = {
    completedCount: completed.length,
    completedTitles: completed.map((t) => t.title),
    createdCount: created.length,
    openCount: active.length,
    overdueCount: overdue.length,
  };

  let message: string;
  try {
    const result = await generateWeeklyReport(JSON.stringify(reportData, null, 2));
    message = result.summary;
  } catch (err) {
    log.warn(err, "AI weekly report generation failed — using fallback formatting");
    message = formatWeeklyFallback({
      completed: completed.length,
      created: created.length,
      open: active.length,
      overdue: overdue.length,
    });
  }

  await botRespondQueue.add("respond", { chatId, text: message, parseMode: "HTML" });
  await saveDailySummary(teamId, today, "weekly_report", message);
  log.info({ teamId }, "Weekly report sent");
}
