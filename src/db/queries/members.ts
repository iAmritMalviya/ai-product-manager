import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { members } from "../schema/index.js";

export async function findOrCreateMember(
  teamId: string,
  telegramUserId: number,
  displayName: string,
  username: string | undefined
) {
  const existing = await db.query.members.findFirst({
    where: and(
      eq(members.teamId, teamId),
      eq(members.telegramUserId, telegramUserId)
    ),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(members)
    .values({ teamId, telegramUserId, displayName, username: username ?? null })
    .returning();

  return created;
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
