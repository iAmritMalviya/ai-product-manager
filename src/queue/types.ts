export interface MessageIngestPayload {
  chatId: number;
  senderId: number;
  senderName: string;
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
