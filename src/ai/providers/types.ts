import z from "zod";

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StructuredOutputOptions<T extends z.ZodType> {
  messages: ChatMessage[];
  schema: T;
  schemaName: string;
} 

export interface AIProvider {
  chatWithStructuredOutput<T extends z.ZodType>
  (options: StructuredOutputOptions<T>): Promise<z.infer<T>>;
}

