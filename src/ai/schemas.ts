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

export const responseDecisionSchema = z.object({
  shouldRespond: z.boolean(),
  responseType: z.enum([
    "confirm_task",
    "ack_status",
    "clarify_assignee",
    "clarify_deadline",
    "clarify_ambiguous",
    "silent",
  ]),
  message: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ResponseDecision = z.infer<typeof responseDecisionSchema>;

export const standupSummarySchema = z.object({
  summary: z.string(),
});

export type StandupSummary = z.infer<typeof standupSummarySchema>;

export const weeklyReportSchema = z.object({
  summary: z.string(),
});

export type WeeklyReport = z.infer<typeof weeklyReportSchema>;
