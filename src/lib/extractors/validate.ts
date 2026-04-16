import { fileTypeFromBuffer } from "file-type";
import { logger } from "../logger.js";

const log = logger.child({ module: "file-validator" });

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/json",
]);

export interface FileValidationResult {
  valid: boolean;
  actualMimeType: string | null;
  reason?: string;
}

export async function validateFile(
  buffer: Buffer,
  claimedMimeType: string | null
): Promise<FileValidationResult> {
  const detected = await fileTypeFromBuffer(buffer);
  const actualMime = detected?.mime ?? claimedMimeType;

  // Text-based files won't have magic bytes — trust claimed type
  if (!detected && claimedMimeType) {
    const textTypes = ["text/csv", "text/plain", "text/markdown", "application/json"];
    if (textTypes.includes(claimedMimeType)) {
      return { valid: true, actualMimeType: claimedMimeType };
    }
  }

  if (!actualMime) {
    return { valid: false, actualMimeType: null, reason: "Could not determine file type" };
  }

  if (!ALLOWED_MIME_TYPES.has(actualMime)) {
    log.warn({ claimedMimeType, actualMimeType: actualMime }, "Unsupported file type");
    return { valid: false, actualMimeType: actualMime, reason: `Unsupported file type: ${actualMime}` };
  }

  if (claimedMimeType && detected && claimedMimeType !== detected.mime) {
    log.warn({ claimedMimeType, actualMimeType: detected.mime }, "MIME type mismatch");
  }

  return { valid: true, actualMimeType: actualMime };
}

const MAX_EXTRACTED_TEXT_LENGTH = 100_000;

export function sanitizeExtractedText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}
