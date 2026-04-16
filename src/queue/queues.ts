import { Queue } from "bullmq";
import type { DefaultJobOptions } from "bullmq";
import { redisConnection } from "./connection.js";
import type { MessageIngestPayload, BotRespondPayload, ScheduledJobPayload, DocumentIngestPayload } from "./types.js";

const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 604800 },
};

export const messageIngestQueue = new Queue<MessageIngestPayload>(
  "message.ingest",
  { connection: redisConnection, defaultJobOptions }
);

export const botRespondQueue = new Queue<BotRespondPayload>(
  "bot.respond",
  { connection: redisConnection, defaultJobOptions }
);

const documentJobOptions: DefaultJobOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 604800 },
};

export const documentIngestQueue = new Queue<DocumentIngestPayload>(
  "document.ingest",
  { connection: redisConnection, defaultJobOptions: documentJobOptions }
);

export const scheduledJobsQueue = new Queue<ScheduledJobPayload>(
  "scheduled.jobs",
  { connection: redisConnection, defaultJobOptions }
);
