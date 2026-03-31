import { and, eq, desc } from "drizzle-orm";
import { db } from "../client.js";
import { messages } from "../schema/index.js";

export async function saveMessage(data: {
  teamId: string;
  memberId: string;
  telegramMessageId: number;
  text: string;
  classification?: "task_creation" | "status_update" | "deadline_mention" | "task_question" | "general_discussion" | "bot_command" | null;
  classificationConfidence?: number | null;
}) {
  const [message] = await db
    .insert(messages)
    .values({
      teamId: data.teamId,
      memberId: data.memberId,
      telegramMessageId: data.telegramMessageId,
      text: data.text,
      classification: data.classification ?? null,
      classificationConfidence: data.classificationConfidence ?? null,
    })
    .onConflictDoNothing({ target: [messages.teamId, messages.telegramMessageId] })
    .returning();

  return message ?? null;
}

export async function getRecentMessages(chatTeamId: string, limit = 5) {
  return db.query.messages.findMany({
    where: eq(messages.teamId, chatTeamId),
    orderBy: desc(messages.createdAt),
    limit,
  });
}
