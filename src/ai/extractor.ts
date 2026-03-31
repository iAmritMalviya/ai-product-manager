import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { openai } from "./client.js";
import {
  extractionResultSchema,
  type ExtractionResult,
  type ClassificationResult,
} from "./schemas.js";

const systemPrompt = `You are an entity extractor for a project management bot. Given a classified message from a Telegram group chat, extract structured task-related entities.

## Fields to Extract

- **assignee**: The person responsible for the task. Use their name exactly as mentioned. Set null if no one is assigned or volunteering.
- **taskTitle**: A concise title for the task (2-6 words). Derive from the message content. Set null if no clear task is described.
- **deadline**: The deadline as mentioned in natural language (e.g., "Friday", "next Monday", "March 15", "EOD"). Do NOT convert to a date — just extract the raw text. Set null if no deadline is mentioned.
- **status**: The task status based on context:
  - "proposed" — task is being suggested or discussed, not yet confirmed
  - "open" — task is confirmed but not started
  - "in_progress" — someone is actively working on it
  - "blocked" — work is stuck
  - "done" — task is completed
  - "cancelled" — task is dropped
  Set null if status can't be determined.
- **priority**: The urgency level if mentioned or strongly implied. "ASAP" or "urgent" → "urgent". "When you get a chance" → "low". Set null if not mentioned.
- **referencedTaskKeywords**: Keywords that might match existing tasks. Extract 1-3 key terms from the message that could be used to find related tasks (e.g., ["auth", "module"] or ["payment", "bug"]).

## Rules

1. Extract only what is explicitly stated or strongly implied. Do not invent information.
2. For assignee, extract the name/username as written — normalization happens downstream.
3. For status, infer from context: "I'll do X" → proposed, "X is done" → done, "working on X" → in_progress.
4. Set confidence based on how clearly the entities were expressed. Ambiguous messages get lower confidence.
5. If the classification is status_update, focus on identifying which task is being updated and to what status.
6. If the classification is deadline_mention, focus on the deadline and which task it applies to.`;

export async function extractEntities(
  text: string,
  classification: ClassificationResult,
  recentMessages: string[]
): Promise<ExtractionResult> {
  const contextBlock =
    recentMessages.length > 0
      ? `\nRecent messages for context:\n${recentMessages.join("\n")}`
      : "";

  const completion = await openai.chat.completions.parse({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Classification: ${classification.category} (confidence: ${classification.confidence})\nMessage: ${text}${contextBlock}`,
      },
    ],
    response_format: zodResponseFormat(extractionResultSchema, "extraction"),
  });

  const parsed = completion.choices[0].message.parsed;
  if (!parsed) {
    throw new Error("Failed to parse extraction response");
  }

  return parsed;
}
