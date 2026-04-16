import { getAIProvider } from "../../ai/providers/index.js";
import { logger } from "../logger.js";

const log = logger.child({ module: "extractor:image" });

const VISION_PROMPT = `Extract all text content from this image. If it contains task-related information (assignments, deadlines, status updates, meeting notes, to-do items), structure that clearly with each item on its own line. Return the raw extracted text. If the image has no readable text, describe the key visual content briefly.`;

export async function extractFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  log.info({ mimeType, bufferSize: buffer.length }, "Extracting text from image via vision");
  const provider = await getAIProvider();
  return provider.visionExtract(buffer, mimeType, VISION_PROMPT);
}
