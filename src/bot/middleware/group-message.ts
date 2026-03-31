import type { Context, NextFunction } from "grammy";
import { messageIngestQueue } from "../../queue/queues.js";
import { logger } from "../../lib/logger.js";

export async function groupMessageMiddleware(ctx: Context, next: NextFunction) {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    if (ctx.message?.text && ctx.from) {
      const payload = {
        chatId: ctx.chat.id,
        senderId: ctx.from.id,
        senderName: ctx.from.first_name,
        senderUsername: ctx.from.username ?? null,
        text: ctx.message.text,
        messageId: ctx.message.message_id,
        timestamp: ctx.message.date,
      };

      await messageIngestQueue.add("ingest", payload);
      logger.debug({ chatId: payload.chatId, messageId: payload.messageId }, "Message enqueued");
    }
  }

  await next();
}
