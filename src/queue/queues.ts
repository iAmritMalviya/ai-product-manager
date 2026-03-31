import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import type { MessageIngestPayload, BotRespondPayload } from "./types.js";

export const messageIngestQueue = new Queue<MessageIngestPayload>(
  "message.ingest",
  { connection: redisConnection }
);

export const botRespondQueue = new Queue<BotRespondPayload>(
  "bot.respond",
  { connection: redisConnection }
);
