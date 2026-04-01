import { getAIProvider } from "./providers/index.js";
import {
  standupSummarySchema,
  weeklyReportSchema,
  type StandupSummary,
  type WeeklyReport,
} from "./schemas.js";
import { AIError } from "../lib/errors.js";

const standupPrompt = `You are a concise project manager writing a daily standup message for a Telegram group.

Given a list of tasks with their status, assignee, and deadlines, generate a brief daily standup summary in Telegram HTML format.

## Format Rules

1. Use <b>bold</b> for section headers and task titles.
2. Keep it concise — no one reads walls of text.
3. Group tasks by status: Due Today, In Progress, Blocked, Unassigned.
4. Skip empty sections entirely.
5. Include assignee names where available.
6. End with a short motivational line.
7. Output ONLY the HTML message content. No wrapping tags.`;

const weeklyPrompt = `You are a concise project manager writing a weekly report for a Telegram group.

Given task statistics for the week (completed, new, open, overdue), generate a brief weekly summary in Telegram HTML format.

## Format Rules

1. Use <b>bold</b> for section headers and key numbers.
2. Keep it concise — summary style, not detailed breakdown.
3. Include: Completed count, New tasks count, Still open count, Overdue count.
4. If velocity data is available (completed this week vs last), mention the trend.
5. End with a brief outlook or encouragement.
6. Output ONLY the HTML message content. No wrapping tags.`;

export async function generateStandup(
  tasksData: string
): Promise<StandupSummary> {
  try {
    const provider = await getAIProvider();

    return await provider.chatWithStructuredOutput({
      messages: [
        { role: "system", content: standupPrompt },
        { role: "user", content: tasksData },
      ],
      schema: standupSummarySchema,
      schemaName: "standup_summary",
    });
  } catch (err) {
    throw new AIError("Failed to generate standup summary", err);
  }
}

export async function generateWeeklyReport(
  reportData: string
): Promise<WeeklyReport> {
  try {
    const provider = await getAIProvider();

    return await provider.chatWithStructuredOutput({
      messages: [
        { role: "system", content: weeklyPrompt },
        { role: "user", content: reportData },
      ],
      schema: weeklyReportSchema,
      schemaName: "weekly_report",
    });
  } catch (err) {
    throw new AIError("Failed to generate weekly report", err);
  }
}
