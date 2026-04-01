import { Worker } from "bullmq";
import { Api } from "grammy";
import { createRedisConnection } from "../queue/connection.js";
import type { BotRespondPayload } from "../queue/types.js";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";

const api = new Api(env.TELEGRAM_BOT_TOKEN);

export const botRespondWorker = new Worker<BotRespondPayload>(
  "bot.respond",
  async (job) => {
    const { chatId, text, replyToMessageId, parseMode } = job.data;
    const log = logger.child({ jobId: job.id, chatId });

    try {
      await api.sendMessage(chatId, text, {
        reply_to_message_id: replyToMessageId,
        parse_mode: parseMode ?? "HTML",
      });
      log.info("Response sent");
    } catch (err) {
      log.error(err, "Failed to send response");
      throw err;
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

botRespondWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Bot respond job failed");
});
