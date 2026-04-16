import mammoth from "mammoth";
import { logger } from "../logger.js";

const log = logger.child({ module: "extractor:docx" });

export async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    log.warn({ messages: result.messages }, "Mammoth extraction warnings");
  }

  log.info({ textLength: result.value.length }, "DOCX text extracted");
  return result.value;
}
