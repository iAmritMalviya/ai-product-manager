import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { documents } from "../schema/index.js";

export async function saveDocument(data: {
  teamId: string;
  memberId: string;
  messageId?: string | null;
  telegramMessageId: number;
  telegramFileId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number;
  extractedText: string | null;
  summary: string | null;
  extractionMethod: string | null;
}) {
  const [doc] = await db
    .insert(documents)
    .values({
      teamId: data.teamId,
      memberId: data.memberId,
      messageId: data.messageId ?? null,
      telegramMessageId: data.telegramMessageId,
      telegramFileId: data.telegramFileId,
      fileName: data.fileName ?? null,
      mimeType: data.mimeType ?? null,
      fileSize: data.fileSize,
      extractedText: data.extractedText ?? null,
      summary: data.summary ?? null,
      extractionMethod: data.extractionMethod ?? null,
    })
    .onConflictDoNothing({ target: [documents.teamId, documents.telegramMessageId] })
    .returning();

  return doc ?? null;
}

export async function updateDocumentTasksExtracted(
  documentId: string,
  count: number
) {
  const [updated] = await db
    .update(documents)
    .set({ tasksExtracted: count })
    .where(eq(documents.id, documentId))
    .returning();
  return updated;
}

export async function findDocumentByTeamAndMessage(
  teamId: string,
  telegramMessageId: number
) {
  return db.query.documents.findFirst({
    where: and(
      eq(documents.teamId, teamId),
      eq(documents.telegramMessageId, telegramMessageId)
    ),
  });
}
