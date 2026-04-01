import type { CommandContext, Context } from "grammy";

export function pingCommand(ctx: CommandContext<Context>) {
  return ctx.reply("pong");
}
