import { z } from "zod";

export const classificationResultSchema = z.object({
  category: z.enum([
    "task_creation",
    "status_update",
    "deadline_mention",
    "task_question",
    "general_discussion",
    "bot_command",
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

export const extractionResultSchema = z.object({
  assignee: z.string().nullable(),
  taskTitle: z.string().nullable(),
  deadline: z.string().nullable(),
  status: z
    .enum(["proposed", "open", "in_progress", "blocked", "done", "cancelled"])
    .nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable(),
  referencedTaskKeywords: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
