import { Bot } from "grammy";
import { env } from "../env.js";
import { pingCommand } from "./commands/ping.js";
import { groupMessageMiddleware } from "./middleware/group-message.js";

export function createBot() {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.use(groupMessageMiddleware);
  bot.command("ping", pingCommand);

  return bot;
}
