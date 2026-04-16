export interface MessageIngestPayload {
  chatId: number;
  senderId: number;
  senderName: string;
  senderUsername: string | null;
  text: string;
  messageId: number;
  timestamp: number;
}

export interface BotRespondPayload {
  chatId: number;
  text: string;
  replyToMessageId?: number;
  parseMode?: "HTML" | "MarkdownV2";
}

export interface DocumentIngestPayload {
  chatId: number;
  senderId: number;
  senderName: string;
  senderUsername: string | null;
  messageId: number;
  timestamp: number;
  caption: string | null;
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number;
  filePath: string;
}

export interface ScheduledJobPayload {
  teamId: string;
  teamName: string;
  chatId: number;
  timezone: string;
  jobType: "daily_standup" | "overdue_nudge" | "weekly_report";
}
