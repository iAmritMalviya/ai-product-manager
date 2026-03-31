import { Worker } from "bullmq";
import * as chrono from "chrono-node";
import { createRedisConnection } from "../queue/connection.js";
import type { MessageIngestPayload } from "../queue/types.js";
import { classifyMessage } from "../ai/classifier.js";
import { extractEntities } from "../ai/extractor.js";
import { findOrCreateTeam } from "../db/queries/teams.js";
import { findOrCreateMember, findMemberByName } from "../db/queries/members.js";
import {
  saveMessage,
  getRecentMessagesWithSenders,
  updateMessageClassification,
} from "../db/queries/messages.js";
import {
  createTask,
  updateTaskStatus,
  updateTaskDeadline,
  findTaskByKeywords,
} from "../db/queries/tasks.js";
import { logger } from "../lib/logger.js";

function formatContextWindow(
  rows: Array<{ text: string; displayName: string; username: string | null }>
): string[] {
  return rows.map((m) => {
    const sender = m.username ? `${m.displayName} (@${m.username})` : m.displayName;
    return `${sender}: ${m.text}`;
  });
}

export const messageIngestWorker = new Worker<MessageIngestPayload>(
  "message.ingest",
  async (job) => {
    const { chatId, senderId, senderName, senderUsername, text, messageId, timestamp } = job.data;
    const log = logger.child({ jobId: job.id, chatId, messageId });

    try {
      // Stage 1: Register team + member (race-safe upserts)
      const team = await findOrCreateTeam(chatId, `Chat ${chatId}`);
      const member = await findOrCreateMember(team.id, senderId, senderName, senderUsername);

      // Stage 2: Save message WITHOUT classification (idempotency gate)
      const saved = await saveMessage({
        teamId: team.id,
        memberId: member.id,
        telegramMessageId: messageId,
        text,
      });

      if (!saved) {
        log.info("Duplicate message — skipping");
        return { classification: null, extraction: null, persisted: false };
      }

      // Stage 3: Fetch context window (50 recent messages, exclude self)
      const recentDbMessages = await getRecentMessagesWithSenders(team.id, 50, messageId);
      const context = formatContextWindow(recentDbMessages.reverse());

      // Stage 4: Classify (with conversation context)
      const classification = await classifyMessage(text, senderName, context);
      log.info(
        { category: classification.category, confidence: classification.confidence },
        "Message classified"
      );

      // Stage 5: Persist classification on the saved message
      await updateMessageClassification(saved.id, classification.category, classification.confidence);

      // Stage 6: Early exit for general discussion
      if (
        classification.category === "general_discussion" &&
        classification.confidence > 0.8
      ) {
        log.info("Skipping extraction — general discussion");
        return { classification, extraction: null, persisted: true };
      }

      // Stage 7: Extract entities (with same context)
      const extraction = await extractEntities(text, classification, context);
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

      // Stage 8: Persist extracted data
      const referenceDate = new Date(timestamp * 1000);

      if (classification.category === "task_creation" && extraction.taskTitle) {
        const assignee = extraction.assignee
          ? await findMemberByName(team.id, extraction.assignee)
          : null;

        const deadline = extraction.deadline
          ? chrono.parseDate(extraction.deadline, referenceDate) ?? null
          : null;

        const task = await createTask({
          teamId: team.id,
          title: extraction.taskTitle,
          assigneeId: assignee?.id ?? null,
          status: extraction.status ?? "proposed",
          priority: extraction.priority ?? null,
          deadline,
          triggeredById: member.id,
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
        const parsedDeadline = chrono.parseDate(extraction.deadline, referenceDate);

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
