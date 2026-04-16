import { Worker } from "bullmq";
import fs from "node:fs/promises";
import * as chrono from "chrono-node";
import { createRedisConnection } from "../queue/connection.js";
import type { DocumentIngestPayload } from "../queue/types.js";
import { extractText } from "../lib/extractors/index.js";
import { summarizeDocument } from "../ai/document-summarizer.js";
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
  saveDocument,
  updateDocumentTasksExtracted,
  findDocumentByTeamAndMessage,
} from "../db/queries/documents.js";
import {
  createTask,
  updateTaskStatus,
  updateTaskDeadline,
  findTaskByKeywords,
} from "../db/queries/tasks.js";
import { botRespondQueue } from "../queue/queues.js";
import { logger } from "../lib/logger.js";
import { env } from "../env.js";

function formatContextWindow(
  rows: Array<{ text: string; displayName: string; username: string | null }>
): string[] {
  return rows.map((m) => {
    const sender = m.username ? `${m.displayName} (@${m.username})` : m.displayName;
    return `${sender}: ${m.text}`;
  });
}

export const documentIngestWorker = new Worker<DocumentIngestPayload>(
  "document.ingest",
  async (job) => {
    const {
      chatId, senderId, senderName, senderUsername,
      messageId, timestamp, caption, fileId,
      fileName, mimeType, fileSize, filePath,
    } = job.data;
    const log = logger.child({ jobId: job.id, chatId, messageId, fileName });
    const startTime = Date.now();

    try {
      // Stage 1: Register team + member
      const team = await findOrCreateTeam(chatId, `Chat ${chatId}`);
      const member = await findOrCreateMember(team.id, senderId, senderName, senderUsername);

      // Stage 2: Save message placeholder
      const messageText = caption || `[Document: ${fileName ?? "uploaded file"}]`;
      const saved = await saveMessage({
        teamId: team.id,
        memberId: member.id,
        telegramMessageId: messageId,
        text: messageText,
        classification: "document_upload",
      });

      // Stage 3: Check if document already processed (idempotency on retry)
      const existingDoc = await findDocumentByTeamAndMessage(team.id, messageId);
      if (existingDoc?.extractedText) {
        log.info("Document already processed — skipping");
        return { persisted: true, alreadyProcessed: true };
      }

      // Stage 4: Extract text from file
      let extractionResult: { text: string; method: string };
      try {
        extractionResult = await extractText(filePath, mimeType);
      } catch (err) {
        log.error(err, "Text extraction failed");

        await saveDocument({
          teamId: team.id,
          memberId: member.id,
          messageId: saved?.id ?? null,
          telegramMessageId: messageId,
          telegramFileId: fileId,
          fileName,
          mimeType,
          fileSize,
          extractedText: null,
          summary: null,
          extractionMethod: "failed",
        });

        await botRespondQueue.add("respond", {
          chatId,
          text: `I couldn't process <b>${fileName ?? "this file"}</b>. ${err instanceof Error ? err.message : "Unknown error."}`,
          replyToMessageId: messageId,
          parseMode: "HTML",
        });

        return { persisted: true, extractionFailed: true };
      }

      log.info(
        { method: extractionResult.method, textLength: extractionResult.text.length },
        "Text extracted"
      );

      // Stage 5: Summarize if too long
      let textForAI = extractionResult.text;
      let summary: string | null = null;
      if (extractionResult.text.length > env.DOCUMENT_SUMMARIZATION_THRESHOLD) {
        summary = await summarizeDocument(extractionResult.text, fileName);
        textForAI = summary;
        log.info(
          { originalLength: extractionResult.text.length, summaryLength: summary.length },
          "Document summarized"
        );
      }

      // Stage 6: Save document to DB
      const doc = await saveDocument({
        teamId: team.id,
        memberId: member.id,
        messageId: saved?.id ?? null,
        telegramMessageId: messageId,
        telegramFileId: fileId,
        fileName,
        mimeType,
        fileSize,
        extractedText: extractionResult.text,
        summary,
        extractionMethod: extractionResult.method,
      });

      if (!doc) {
        log.info("Duplicate document — skipping");
        return { persisted: false };
      }

      // Stage 7: Classify extracted content
      const fullText = caption
        ? `[Caption: ${caption}]\n\n${textForAI}`
        : textForAI;

      const recentDbMessages = await getRecentMessagesWithSenders(team.id, 50, messageId);
      const context = formatContextWindow(recentDbMessages.reverse());

      const classification = await classifyMessage(fullText, senderName, context);
      log.info(
        { category: classification.category, confidence: classification.confidence },
        "Document content classified"
      );

      if (saved) {
        await updateMessageClassification(saved.id, classification.category, classification.confidence);
      }

      let tasksCreated = 0;

      // Stage 8: Extract entities + persist (skip for non-actionable categories)
      if (
        classification.category !== "general_discussion" &&
        classification.category !== "bot_command" &&
        classification.category !== "document_upload"
      ) {
        const extraction = await extractEntities(fullText, classification, context);
        log.info(
          { assignee: extraction.assignee, taskTitle: extraction.taskTitle },
          "Entities extracted from document"
        );

        const referenceDate = new Date(timestamp * 1000);

        if (classification.category === "task_creation" && extraction.taskTitle) {
          const assignee = extraction.assignee
            ? await findMemberByName(team.id, extraction.assignee)
            : null;

          const deadline = extraction.deadline
            ? chrono.parseDate(extraction.deadline, referenceDate) ?? null
            : null;

          await createTask({
            teamId: team.id,
            title: extraction.taskTitle,
            assigneeId: assignee?.id ?? null,
            status: extraction.status ?? "proposed",
            priority: extraction.priority ?? null,
            deadline,
            triggeredById: member.id,
          });
          tasksCreated++;
        }

        if (classification.category === "status_update" && extraction.status) {
          const matchedTask = await findTaskByKeywords(team.id, extraction.referencedTaskKeywords);
          if (matchedTask) {
            await updateTaskStatus(matchedTask.id, extraction.status, member.id);
          }
        }

        if (classification.category === "deadline_mention" && extraction.deadline) {
          const matchedTask = await findTaskByKeywords(team.id, extraction.referencedTaskKeywords);
          const parsedDeadline = chrono.parseDate(extraction.deadline, referenceDate);
          if (matchedTask && parsedDeadline) {
            await updateTaskDeadline(matchedTask.id, parsedDeadline, member.id);
          }
        }
      }

      if (tasksCreated > 0) {
        await updateDocumentTasksExtracted(doc.id, tasksCreated);
      }

      // Stage 9: Send response
      const displayName = fileName ? `<b>${fileName}</b>` : "the uploaded file";
      const taskSuffix = tasksCreated > 0
        ? ` Tracked ${tasksCreated} new task${tasksCreated > 1 ? "s" : ""}.`
        : "";

      await botRespondQueue.add("respond", {
        chatId,
        text: `Processed ${displayName}.${taskSuffix}`,
        replyToMessageId: messageId,
        parseMode: "HTML",
      });

      log.info({ durationMs: Date.now() - startTime, tasksCreated }, "Document processed");
      return { classification, tasksCreated, persisted: true };
    } catch (err) {
      log.error(err, "Failed to process document");
      throw err;
    } finally {
      try {
        await fs.unlink(filePath);
        log.debug({ filePath }, "Temp file cleaned up");
      } catch {
        // File may already be deleted
      }
    }
  },
  { connection: createRedisConnection(), concurrency: 2 }
);

documentIngestWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "Document ingest job failed");
  if (job?.data?.filePath) {
    fs.unlink(job.data.filePath).catch(() => {});
  }
});
