import type { Context, NextFunction } from "grammy";
import { logger } from "../../lib/logger.js";

export async function groupMessageMiddleware(ctx: Context, next: NextFunction) {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    if (ctx.message?.text) {
      logger.info(
        {
          chatId: ctx.chat.id,
          senderId: ctx.from?.id,
          senderName: ctx.from?.first_name ?? "Unknown",
          text: ctx.message.text,
          messageId: ctx.message.message_id,
        },
        "Group message received"
      );
    }
  }

  await next();
}
