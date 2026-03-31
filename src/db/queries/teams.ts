import { db } from "../client.js";
import { teams } from "../schema/index.js";

export async function findOrCreateTeam(chatId: number, name: string) {
  const [team] = await db
    .insert(teams)
    .values({ telegramChatId: chatId, name })
    .onConflictDoUpdate({
      target: [teams.telegramChatId],
      set: { name },
    })
    .returning();

  return team;
}
