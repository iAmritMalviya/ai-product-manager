import fs from "node:fs/promises";
import { extractFromImage } from "./image.js";
import { extractFromPdf } from "./pdf.js";
import { extractFromDocx } from "./docx.js";
import { extractFromSpreadsheet } from "./spreadsheet.js";
import { extractFromPlaintext } from "./plaintext.js";
import { validateFile, sanitizeExtractedText } from "./validate.js";
import { logger } from "../logger.js";

const log = logger.child({ module: "extractor" });

export interface TextExtractionResult {
  text: string;
  method: string;
}

const MIME_TO_CATEGORY: Record<string, string> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "text/csv": "spreadsheet",
  "text/plain": "plaintext",
  "text/markdown": "plaintext",
  "application/json": "plaintext",
};

export async function extractText(
  filePath: string,
  claimedMimeType: string | null
): Promise<TextExtractionResult> {
  const buffer = await fs.readFile(filePath);

  const validation = await validateFile(buffer, claimedMimeType);
  if (!validation.valid) {
    throw new Error(validation.reason ?? "Invalid file type");
  }

  const mimeType = validation.actualMimeType!;
  const category = MIME_TO_CATEGORY[mimeType];

  if (!category) {
    throw new Error(`No extractor for MIME type: ${mimeType}`);
  }

  log.info({ mimeType, category, filePath }, "Extracting text");

  let result: TextExtractionResult;

  switch (category) {
    case "image":
      result = { text: await extractFromImage(buffer, mimeType), method: "vision" };
      break;
    case "pdf": {
      const pdfResult = await extractFromPdf(buffer);
      result = { text: pdfResult.text, method: pdfResult.method };
      break;
    }
    case "docx":
      result = { text: await extractFromDocx(buffer), method: "mammoth" };
      break;
    case "spreadsheet":
      result = { text: extractFromSpreadsheet(buffer), method: "xlsx" };
      break;
    case "plaintext":
      result = { text: extractFromPlaintext(buffer), method: "plaintext" };
      break;
    default:
      throw new Error(`Unknown category: ${category}`);
  }

  result.text = sanitizeExtractedText(result.text);
  return result;
}
