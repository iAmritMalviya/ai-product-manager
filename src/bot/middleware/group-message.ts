import type { Context, NextFunction } from "grammy";
import { messageIngestQueue } from "../../queue/queues.js";
import { logger } from "../../lib/logger.js";
import { sanitizeMessageText, MAX_MESSAGE_LENGTH } from "../../lib/validation.js";

export async function groupMessageMiddleware(ctx: Context, next: NextFunction) {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    if (ctx.message?.text && ctx.from) {
      if (ctx.message.text.length > MAX_MESSAGE_LENGTH) {
        logger.warn(
          { chatId: ctx.chat.id, messageId: ctx.message.message_id, length: ctx.message.text.length },
          "Message exceeds max length — skipping"
        );
        await next();
        return;
      }

      const payload = {
        chatId: ctx.chat.id,
        senderId: ctx.from.id,
        senderName: ctx.from.first_name,
        senderUsername: ctx.from.username ?? null,
        text: sanitizeMessageText(ctx.message.text),
        messageId: ctx.message.message_id,
        timestamp: ctx.message.date,
      };

      await messageIngestQueue.add("ingest", payload);
      logger.debug({ chatId: payload.chatId, messageId: payload.messageId }, "Message enqueued");
    }
  }

  await next();
}
