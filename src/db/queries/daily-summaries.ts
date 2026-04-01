import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { dailySummaries } from "../schema/index.js";

export async function saveDailySummary(
  teamId: string,
  summaryDate: string,
  summaryType: "daily_standup" | "overdue_nudge" | "weekly_report",
  content: string
) {
  const [summary] = await db
    .insert(dailySummaries)
    .values({ teamId, summaryDate, summaryType, content })
    .onConflictDoNothing()
    .returning();

  return summary ?? null;
}

export async function summaryExistsForToday(
  teamId: string,
  summaryDate: string,
  summaryType: "daily_standup" | "overdue_nudge" | "weekly_report"
) {
  const existing = await db.query.dailySummaries.findFirst({
    where: and(
      eq(dailySummaries.teamId, teamId),
      eq(dailySummaries.summaryDate, summaryDate),
      eq(dailySummaries.summaryType, summaryType)
    ),
  });

  return !!existing;
}
