import type { Context, NextFunction } from "grammy";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { documentIngestQueue } from "../../queue/queues.js";
import { messageIngestQueue } from "../../queue/queues.js";
import { logger } from "../../lib/logger.js";
import { env, tempFileDir } from "../../env.js";
import { sanitizeMessageText } from "../../lib/validation.js";

const log = logger.child({ module: "document-middleware" });
const MAX_SIZE_BYTES = env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

export async function documentMessageMiddleware(ctx: Context, next: NextFunction) {
  if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
    await next();
    return;
  }

  if (!ctx.from || !ctx.message) {
    await next();
    return;
  }

  const photo = ctx.message.photo;
  const document = ctx.message.document;

  if (!photo && !document) {
    await next();
    return;
  }

  let fileId: string;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  let fileSize = 0;

  if (photo) {
    const largest = photo[photo.length - 1];
    fileId = largest.file_id;
    mimeType = "image/jpeg";
    fileSize = largest.file_size ?? 0;
  } else if (document) {
    fileId = document.file_id;
    fileName = document.file_name ?? null;
    mimeType = document.mime_type ?? null;
    fileSize = document.file_size ?? 0;
  } else {
    await next();
    return;
  }

  if (fileSize > MAX_SIZE_BYTES) {
    log.warn(
      { chatId: ctx.chat.id, fileSize, maxSize: MAX_SIZE_BYTES },
      "File exceeds max size — skipping"
    );
    await next();
    return;
  }

  try {
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      log.warn({ fileId }, "Telegram getFile returned no file_path");
      await next();
      return;
    }

    const downloadUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      log.error({ status: response.status, fileId }, "Failed to download file from Telegram");
      await next();
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const tempFileName = `doc-${crypto.randomUUID()}${path.extname(fileName ?? ".tmp")}`;
    const tempFilePath = path.join(tempFileDir, tempFileName);
    await fs.writeFile(tempFilePath, buffer);

    const caption = ctx.message.caption ?? null;

    await documentIngestQueue.add("ingest", {
      chatId: ctx.chat.id,
      senderId: ctx.from.id,
      senderName: ctx.from.first_name,
      senderUsername: ctx.from.username ?? null,
      messageId: ctx.message.message_id,
      timestamp: ctx.message.date,
      caption,
      fileId,
      fileName,
      mimeType,
      fileSize: buffer.length,
      filePath: tempFilePath,
    });

    log.debug(
      { chatId: ctx.chat.id, messageId: ctx.message.message_id, fileName, mimeType },
      "Document enqueued"
    );

    // Also enqueue caption as regular message for conversation context
    if (caption) {
      await messageIngestQueue.add("ingest", {
        chatId: ctx.chat.id,
        senderId: ctx.from.id,
        senderName: ctx.from.first_name,
        senderUsername: ctx.from.username ?? null,
        text: sanitizeMessageText(caption),
        messageId: ctx.message.message_id,
        timestamp: ctx.message.date,
      });
    }
  } catch (err) {
    log.error(err, "Failed to process document upload");
  }

  await next();
}
