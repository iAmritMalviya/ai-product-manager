import { Worker } from "bullmq";
import { createRedisConnection } from "../queue/connection.js";
import type { ScheduledJobPayload } from "../queue/types.js";
import { handleDailyStandup, handleOverdueNudge, handleWeeklyReport } from "../scheduler/jobs.js";
import { logger } from "../lib/logger.js";

export const scheduledWorker = new Worker<ScheduledJobPayload>(
  "scheduled.jobs",
  async (job) => {
    const { teamId, teamName, chatId, timezone, jobType } = job.data;
    const log = logger.child({ jobId: job.id, teamId, jobType });
    const startTime = Date.now();

    try {
      switch (jobType) {
        case "daily_standup":
          await handleDailyStandup(teamId, chatId, teamName, timezone);
          break;
        case "overdue_nudge":
          await handleOverdueNudge(teamId, chatId, timezone);
          break;
        case "weekly_report":
          await handleWeeklyReport(teamId, chatId, timezone);
          break;
        default:
          log.warn({ jobType }, "Unknown scheduled job type");
      }

      log.info({ durationMs: Date.now() - startTime }, "Scheduled job completed");
    } catch (err) {
      log.error(err, "Failed to process scheduled job");
      throw err;
    }
  },
  { connection: createRedisConnection(), concurrency: 3 }
);

scheduledWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Scheduled job failed");
});
