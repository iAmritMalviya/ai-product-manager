import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { teams } from "../schema/index.js";

export async function findOrCreateTeam(chatId: number, name: string) {
  const existing = await db.query.teams.findFirst({
    where: eq(teams.telegramChatId, chatId),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(teams)
    .values({ telegramChatId: chatId, name })
    .returning();

  return created;
}
