import type { Bot, Context } from "grammy";
import type { Worker, Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Sql } from "postgres";
import type { ServerType } from "@hono/node-server";
import { logger } from "./logger.js";

const log = logger.child({ module: "shutdown" });
const SHUTDOWN_TIMEOUT_MS = 10_000;

interface ShutdownResources {
  bot: Bot<Context>;
  httpServer: ServerType;
  workers: Worker[];
  queues: Queue[];
  dbClient: Sql;
  redisConnection: Redis;
}

export function setupGracefulShutdown(resources: ShutdownResources) {
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    log.info({ signal }, "Graceful shutdown initiated");

    const timeout = setTimeout(() => {
      log.error("Shutdown timed out — forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // 1. Stop accepting new Telegram updates
      log.info("Stopping bot...");
      await resources.bot.stop();

      // 2. Close workers (wait for active jobs)
      log.info("Closing workers...");
      await Promise.all(resources.workers.map((w) => w.close()));

      // 3. Close queues
      log.info("Closing queues...");
      await Promise.all(resources.queues.map((q) => q.close()));

      // 4. Close Redis connection
      log.info("Closing Redis...");
      await resources.redisConnection.quit();

      // 5. Close DB connection
      log.info("Closing database...");
      await resources.dbClient.end();

      // 6. Stop HTTP server
      log.info("Stopping HTTP server...");
      resources.httpServer.close();

      clearTimeout(timeout);
      log.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      log.error(err, "Error during shutdown");
      clearTimeout(timeout);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
