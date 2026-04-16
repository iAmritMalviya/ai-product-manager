import { serve } from "@hono/node-server";
import { createBot } from "./bot/bot.js";
import { env } from "./env.js";
import { app } from "./http/server.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./db/migrate.js";
import { client } from "./db/client.js";
import { redisConnection } from "./queue/connection.js";
import { messageIngestQueue, botRespondQueue, scheduledJobsQueue, documentIngestQueue } from "./queue/queues.js";
import { messageIngestWorker } from "./worker/message-ingest.worker.js";
import { botRespondWorker } from "./worker/bot-respond.worker.js";
import { scheduledWorker } from "./worker/scheduled.worker.js";
import { documentIngestWorker } from "./worker/document-ingest.worker.js";
import { registerScheduledJobs } from "./scheduler/register.js";
import { setupGracefulShutdown } from "./lib/shutdown.js";

async function main() {
  if (env.NODE_ENV === "development") {
    await runMigrations(env.DATABASE_URL);
  }

  const bot = createBot();

  bot.start({
    onStart: (botInfo) => {
      logger.info({ username: botInfo.username }, "Bot started");
    },
  });

  logger.info(
    { workerName: messageIngestWorker.name },
    "Message ingest worker started"
  );

  logger.info(
    { workerName: botRespondWorker.name },
    "Bot respond worker started"
  );

  logger.info(
    { workerName: scheduledWorker.name },
    "Scheduled worker started"
  );

  logger.info(
    { workerName: documentIngestWorker.name },
    "Document ingest worker started"
  );

  await registerScheduledJobs();

  const httpServer = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port }, "HTTP server started");
  });

  setupGracefulShutdown({
    bot,
    httpServer,
    workers: [messageIngestWorker, botRespondWorker, scheduledWorker, documentIngestWorker],
    queues: [messageIngestQueue, botRespondQueue, scheduledJobsQueue, documentIngestQueue],
    dbClient: client,
    redisConnection,
  });
}

main().catch((err) => {
  logger.fatal(err, "Failed to start");
  process.exit(1);
});
