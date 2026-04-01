import type { CommandContext, Context } from "grammy";
import { findTeamByChatId } from "../../db/queries/teams.js";
import { findOrCreateMember, getMembersByIds } from "../../db/queries/members.js";
import { getTasksByTeam, getTasksByAssignee, findTaskByKeywords } from "../../db/queries/tasks.js";
import { formatTaskList, formatSingleTask, formatHelp } from "../../lib/telegram-format.js";
import { logger } from "../../lib/logger.js";

async function resolveTeamId(ctx: CommandContext<Context>): Promise<string | null> {
  if (!ctx.chat) return null;
  const team = await findTeamByChatId(ctx.chat.id);
  return team?.id ?? null;
}

export async function tasksCommand(ctx: CommandContext<Context>) {
  try {
    const teamId = await resolveTeamId(ctx);
    if (!teamId) {
      await ctx.reply("No team data found for this chat yet. Send some messages first!");
      return;
    }

    const tasks = await getTasksByTeam(teamId);

    const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))] as string[];
    const members = await getMembersByIds(assigneeIds);
    const memberMap = new Map(members.map((m) => [m.id, m.displayName]));

    const tasksForDisplay = tasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      assigneeName: t.assigneeId ? memberMap.get(t.assigneeId) ?? null : null,
    }));

    await ctx.reply(formatTaskList(tasksForDisplay), { parse_mode: "HTML" });
  } catch (err) {
    logger.error(err, "Failed to handle /tasks command");
    await ctx.reply("Something went wrong. Please try again later.");
  }
}

export async function myTasksCommand(ctx: CommandContext<Context>) {
  try {
    const teamId = await resolveTeamId(ctx);
    if (!teamId || !ctx.from) {
      await ctx.reply("No team data found for this chat yet. Send some messages first!");
      return;
    }

    const member = await findOrCreateMember(
      teamId,
      ctx.from.id,
      ctx.from.first_name,
      ctx.from.username ?? null
    );

    const tasks = await getTasksByAssignee(member.id);

    const tasksForDisplay = tasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      assigneeName: member.displayName,
    }));

    if (tasksForDisplay.length === 0) {
      await ctx.reply("<i>You have no active tasks.</i>", { parse_mode: "HTML" });
      return;
    }

    await ctx.reply(formatTaskList(tasksForDisplay), { parse_mode: "HTML" });
  } catch (err) {
    logger.error(err, "Failed to handle /mytasks command");
    await ctx.reply("Something went wrong. Please try again later.");
  }
}

export async function statusCommand(ctx: CommandContext<Context>) {
  try {
    const teamId = await resolveTeamId(ctx);
    if (!teamId) {
      await ctx.reply("No team data found for this chat yet. Send some messages first!");
      return;
    }

    const query = ctx.match?.toString().trim();
    if (!query) {
      await ctx.reply("Usage: /status &lt;task keywords&gt;", { parse_mode: "HTML" });
      return;
    }

    const keywords = query.split(/\s+/);
    const task = await findTaskByKeywords(teamId, keywords);

    if (!task) {
      await ctx.reply("No matching task found.");
      return;
    }

    let assigneeName: string | null = null;
    if (task.assigneeId) {
      const members = await getMembersByIds([task.assigneeId]);
      assigneeName = members[0]?.displayName ?? null;
    }

    await ctx.reply(
      formatSingleTask({
        title: task.title,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline,
        assigneeName,
      }),
      { parse_mode: "HTML" }
    );
  } catch (err) {
    logger.error(err, "Failed to handle /status command");
    await ctx.reply("Something went wrong. Please try again later.");
  }
}

export async function helpCommand(ctx: CommandContext<Context>) {
  await ctx.reply(formatHelp(), { parse_mode: "HTML" });
}
