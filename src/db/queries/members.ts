import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { members } from "../schema/index.js";

export async function findOrCreateMember(
  teamId: string,
  telegramUserId: number,
  displayName: string,
  username: string | null | undefined
) {
  const [member] = await db
    .insert(members)
    .values({ teamId, telegramUserId, displayName, username: username ?? null })
    .onConflictDoUpdate({
      target: [members.teamId, members.telegramUserId],
      set: { displayName, username: username ?? null },
    })
    .returning();

  return member;
}

export async function findMemberByName(teamId: string, name: string) {
  const normalized = name.toLowerCase().trim();
  const allMembers = await db.query.members.findMany({
    where: eq(members.teamId, teamId),
  });

  return allMembers.find(
    (m) =>
      m.displayName.toLowerCase().trim() === normalized ||
      m.username?.toLowerCase().trim() === normalized
  ) ?? null;
}
