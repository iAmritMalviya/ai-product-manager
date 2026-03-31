import { serve } from "@hono/node-server";
import { createBot } from "./bot/bot.js";
import { env } from "./env.js";
import { app } from "./http/server.js";
import { logger } from "./lib/logger.js";

async function main() {
  const bot = createBot();

  bot.start({
    onStart: (botInfo) => {
      logger.info({ username: botInfo.username }, "Bot started");
    },
  });

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port }, "HTTP server started");
  });
}

main().catch((err) => {
  logger.fatal(err, "Failed to start");
  process.exit(1);
});
