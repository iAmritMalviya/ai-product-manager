import { scheduledJobsQueue } from "../queue/queues.js";
import { getAllTeams } from "../db/queries/teams.js";
import { logger } from "../lib/logger.js";
import type { ScheduledJobPayload } from "../queue/types.js";

const log = logger.child({ module: "scheduler:register" });

interface TeamForScheduling {
  id: string;
  telegramChatId: number;
  name: string;
  timezone: string;
}

const JOB_CONFIGS = [
  { type: "daily_standup" as const, pattern: "0 9 * * 1-5" },
  { type: "overdue_nudge" as const, pattern: "0 10,15 * * 1-5" },
  { type: "weekly_report" as const, pattern: "0 17 * * 5" },
];

export async function registerTeamJobs(team: TeamForScheduling) {
  for (const config of JOB_CONFIGS) {
    const schedulerId = `${config.type}:${team.id}`;
    const payload: ScheduledJobPayload = {
      teamId: team.id,
      teamName: team.name,
      chatId: team.telegramChatId,
      timezone: team.timezone,
      jobType: config.type,
    };

    await scheduledJobsQueue.upsertJobScheduler(
      schedulerId,
      { pattern: config.pattern, tz: team.timezone },
      { name: config.type, data: payload }
    );
  }

  log.info({ teamId: team.id, teamName: team.name, timezone: team.timezone }, "Scheduled jobs registered for team");
}

export async function registerScheduledJobs() {
  const teams = await getAllTeams();

  for (const team of teams) {
    await registerTeamJobs(team);
  }

  log.info({ teamCount: teams.length }, "Scheduled jobs registered for all teams");
}
