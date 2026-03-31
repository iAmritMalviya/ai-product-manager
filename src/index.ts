import { serve } from "@hono/node-server";
import { createBot } from "./bot/bot.js";
import { env } from "./env.js";
import { app } from "./http/server.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./db/migrate.js";
import { messageIngestWorker } from "./worker/message-ingest.worker.js";

async function main() {
  if (env.NODE_ENV === "development") {
    await runMigrations();
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

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port }, "HTTP server started");
  });
}

main().catch((err) => {
  logger.fatal(err, "Failed to start");
  process.exit(1);
});
