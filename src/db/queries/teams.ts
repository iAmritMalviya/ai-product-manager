import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { teams } from "../schema/index.js";

export async function findTeamByChatId(chatId: number) {
  return db.query.teams.findFirst({
    where: eq(teams.telegramChatId, chatId),
  });
}

export async function getAllTeams() {
  return db.query.teams.findMany();
}

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
