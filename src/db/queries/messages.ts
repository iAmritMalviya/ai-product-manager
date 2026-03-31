import { and, eq, ne, desc } from "drizzle-orm";
import { db } from "../client.js";
import { messages, members } from "../schema/index.js";

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

export async function updateMessageClassification(
  messageId: string,
  classification: "task_creation" | "status_update" | "deadline_mention" | "task_question" | "general_discussion" | "bot_command",
  confidence: number
) {
  const [updated] = await db
    .update(messages)
    .set({ classification, classificationConfidence: confidence })
    .where(eq(messages.id, messageId))
    .returning();
  return updated;
}

export async function getRecentMessagesWithSenders(
  teamId: string,
  limit: number,
  excludeTelegramMessageId?: number
) {
  const conditions = [eq(messages.teamId, teamId)];
  if (excludeTelegramMessageId !== undefined) {
    conditions.push(ne(messages.telegramMessageId, excludeTelegramMessageId));
  }

  return db
    .select({
      text: messages.text,
      displayName: members.displayName,
      username: members.username,
    })
    .from(messages)
    .innerJoin(members, eq(messages.memberId, members.id))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}
