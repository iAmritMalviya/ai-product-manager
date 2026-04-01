export const MAX_MESSAGE_LENGTH = 4000;

export function sanitizeMessageText(text: string): string {
  return text
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, MAX_MESSAGE_LENGTH);
}
