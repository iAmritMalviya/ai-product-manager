import { getAIProvider } from "./providers/index.js";
import { classificationResultSchema, type ClassificationResult } from "./schemas.js";
import { AIError } from "../lib/errors.js";

const systemPrompt = `You are a message classifier for a project management bot in a Telegram group chat.

Your job is to classify each message into exactly one category based on its content and intent.

## Categories

- **task_creation**: Someone is assigning work, volunteering for a task, or describing something that needs to be done. Examples: "Amrit will finish the auth module by Friday", "We need to redesign the landing page", "I'll handle the deployment"
- **status_update**: Someone is reporting progress on existing work. Examples: "Auth module is done", "Payment bug is fixed", "I'm halfway through the API migration"
- **deadline_mention**: Someone is setting, changing, or discussing a deadline for existing work. Examples: "Let's push the deadline to next Wednesday", "Can we get this done by EOD?", "The launch date is April 15"
- **task_question**: Someone is asking about task status, assignments, or project progress. Examples: "What's the status of the auth module?", "Who's working on payments?", "Are we on track for launch?"
- **general_discussion**: Casual conversation, greetings, off-topic chat, opinions not related to task management. Examples: "Good morning everyone", "Nice weather today", "That meeting was productive"
- **bot_command**: A direct command to the bot. Examples: "/tasks", "/ping", "/help"

## Rules

1. Focus on the intent, not just keywords. "Let's grab lunch" is general_discussion even though "grab" could sound like an action.
2. When uncertain between task_creation and general_discussion, lean toward general_discussion — false positives are worse than missed tasks.
3. A message can only belong to ONE category. Pick the most dominant intent.
4. Provide a short reasoning (1 sentence) explaining your classification.
5. Set confidence between 0 and 1. Use high confidence (>0.8) only when the intent is unambiguous.
6. You may receive recent conversation history for context. Use it to understand what pronouns ("this", "that", "it") refer to and to understand the flow of conversation. Only classify the CURRENT message — the context is read-only background.`;

export async function classifyMessage(
  text: string,
  senderName: string,
  recentContext: string[] = []
): Promise<ClassificationResult> {
  const contextBlock =
    recentContext.length > 0
      ? `\n\nRecent conversation (do NOT classify these — only classify the current message):\n---\n${recentContext.join("\n")}\n---`
      : "";

  try {
    const provider = await getAIProvider();

    return await provider.chatWithStructuredOutput({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Sender: ${senderName}\nMessage: ${text}${contextBlock}`,
        },
      ],
      schema: classificationResultSchema,
      schemaName: "classification",
    });
  } catch (err) {
    throw new AIError("Failed to classify message", err);
  }
}
