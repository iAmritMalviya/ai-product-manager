import { PDFParse } from "pdf-parse";
import { logger } from "../logger.js";

const log = logger.child({ module: "extractor:pdf" });
const MIN_TEXT_THRESHOLD = 50;

export async function extractFromPdf(
  buffer: Buffer
): Promise<{ text: string; method: string }> {
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  const text = textResult.text?.trim() ?? "";

  await parser.destroy();

  if (text.length >= MIN_TEXT_THRESHOLD) {
    log.info({ textLength: text.length }, "PDF text extracted");
    return { text, method: "pdf-parse" };
  }

  log.warn(
    { textLength: text.length },
    "PDF appears scanned — limited text extracted"
  );

  return {
    text: text.length > 0
      ? text + "\n\n[Note: This PDF appears to be mostly scanned. Only partial text could be extracted.]"
      : "[Scanned PDF — text extraction not possible. Vision-based PDF processing coming in a future update.]",
    method: "pdf-parse-limited",
  };
}
