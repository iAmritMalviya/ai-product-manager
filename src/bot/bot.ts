import { Bot } from "grammy";
import { env } from "../env.js";
import { pingCommand } from "./commands/ping.js";
import { tasksCommand, myTasksCommand, statusCommand, helpCommand } from "./commands/tasks.js";
import { groupMessageMiddleware } from "./middleware/group-message.js";
import { documentMessageMiddleware } from "./middleware/document-message.js";

export function createBot() {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.use(documentMessageMiddleware);
  bot.use(groupMessageMiddleware);
  bot.command("ping", pingCommand);
  bot.command("tasks", tasksCommand);
  bot.command("mytasks", myTasksCommand);
  bot.command("status", statusCommand);
  bot.command("help", helpCommand);

  return bot;
}
