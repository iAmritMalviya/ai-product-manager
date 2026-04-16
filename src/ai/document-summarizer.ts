import { z } from "zod";
import { getAIProvider } from "./providers/index.js";
import { AIError } from "../lib/errors.js";

const documentSummarySchema = z.object({
  summary: z.string(),
});

const systemPrompt = `You are a document summarizer for a project management bot. Given extracted text from an uploaded document, create a focused summary.

## Rules

1. Focus on task-related content: assignments, deadlines, status updates, action items, decisions.
2. Preserve exact names, dates, and specific commitments — these are critical for task extraction.
3. Output each action item as a separate numbered entry.
4. Keep the summary under 1000 words.
5. If the document has no task-related content, summarize the key points briefly.
6. Do not add any information that is not in the original text.`;

export async function summarizeDocument(
  text: string,
  fileName: string | null
): Promise<string> {
  try {
    const provider = await getAIProvider();

    const result = await provider.chatWithStructuredOutput({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Document: ${fileName ?? "Unknown file"}\n\nContent:\n${text}`,
        },
      ],
      schema: documentSummarySchema,
      schemaName: "document_summary",
    });

    return result.summary;
  } catch (err) {
    throw new AIError("Failed to summarize document", err);
  }
}
