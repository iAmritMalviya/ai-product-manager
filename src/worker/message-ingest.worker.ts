import { Worker } from "bullmq";
import * as chrono from "chrono-node";
import { createRedisConnection } from "../queue/connection.js";
import type { MessageIngestPayload } from "../queue/types.js";
import { classifyMessage } from "../ai/classifier.js";
import { extractEntities } from "../ai/extractor.js";
import { findOrCreateTeam } from "../db/queries/teams.js";
import { findOrCreateMember, findMemberByName } from "../db/queries/members.js";
import { saveMessage, getRecentMessages } from "../db/queries/messages.js";
import {
  createTask,
  updateTaskStatus,
  updateTaskDeadline,
  findTaskByKeywords,
} from "../db/queries/tasks.js";
import { logger } from "../lib/logger.js";

export const messageIngestWorker = new Worker<MessageIngestPayload>(
  "message.ingest",
  async (job) => {
    const { chatId, senderId, senderName, text, messageId } = job.data;
    const log = logger.child({ jobId: job.id, chatId, messageId });

    try {
      // Stage 1: Classify
      const classification = await classifyMessage(text, senderName);
      log.info(
        { category: classification.category, confidence: classification.confidence },
        "Message classified"
      );

      // Stage 3a: Auto-register team + member, save message
      const team = await findOrCreateTeam(chatId, `Chat ${chatId}`);
      const member = await findOrCreateMember(team.id, senderId, senderName, undefined);
      const saved = await saveMessage({
        teamId: team.id,
        memberId: member.id,
        telegramMessageId: messageId,
        text,
        classification: classification.category,
        classificationConfidence: classification.confidence,
      });

      // Idempotency: if message already exists, skip
      if (!saved) {
        log.info("Duplicate message — skipping");
        return { classification, extraction: null, persisted: false };
      }

      // Early exit for general discussion
      if (
        classification.category === "general_discussion" &&
        classification.confidence > 0.8
      ) {
        log.info("Skipping extraction — general discussion");
        return { classification, extraction: null, persisted: true };
      }

      // Stage 2: Extract entities (with recent messages for context)
      const recentDbMessages = await getRecentMessages(team.id, 5);
      const recentContext = recentDbMessages
        .reverse()
        .map((m) => m.text);

      const extraction = await extractEntities(text, classification, recentContext);
      log.info(
        {
          assignee: extraction.assignee,
          taskTitle: extraction.taskTitle,
          deadline: extraction.deadline,
          status: extraction.status,
          priority: extraction.priority,
          confidence: extraction.confidence,
        },
        "Entities extracted"
      );

      // Stage 3b: Persist extracted data
      if (classification.category === "task_creation" && extraction.taskTitle) {
        const assignee = extraction.assignee
          ? await findMemberByName(team.id, extraction.assignee)
          : null;

        const deadline = extraction.deadline
          ? chrono.parseDate(extraction.deadline) ?? null
          : null;

        const task = await createTask({
          teamId: team.id,
          title: extraction.taskTitle,
          assigneeId: assignee?.id ?? null,
          status: extraction.status ?? "proposed",
          priority: extraction.priority ?? null,
          deadline,
        });

        log.info({ taskId: task.id, title: task.title }, "Task created");
      }

      if (classification.category === "status_update" && extraction.status) {
        const matchedTask = await findTaskByKeywords(
          team.id,
          extraction.referencedTaskKeywords
        );

        if (matchedTask) {
          await updateTaskStatus(matchedTask.id, extraction.status, member.id);
          log.info(
            { taskId: matchedTask.id, newStatus: extraction.status },
            "Task status updated"
          );
        } else {
          log.warn("Status update but no matching task found");
        }
      }

      if (classification.category === "deadline_mention" && extraction.deadline) {
        const matchedTask = await findTaskByKeywords(
          team.id,
          extraction.referencedTaskKeywords
        );
        const parsedDeadline = chrono.parseDate(extraction.deadline);

        if (matchedTask && parsedDeadline) {
          await updateTaskDeadline(matchedTask.id, parsedDeadline, member.id);
          log.info(
            { taskId: matchedTask.id, deadline: parsedDeadline },
            "Task deadline updated"
          );
        } else {
          log.warn("Deadline mention but no matching task or unparseable date");
        }
      }

      return { classification, extraction, persisted: true };
    } catch (err) {
      log.error(err, "Failed to process message");
      throw err;
    }
  },
  { connection: createRedisConnection(), concurrency: 5 }
);

messageIngestWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Job failed");
});
