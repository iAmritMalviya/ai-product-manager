/**
 * This file demonstrates how to use the Google GenAI API to generate content using the Gemini model.
 * The client is initialized with the API key from the environment variable `GEMINI_API_KEY`.
 * The `main` function generates content by calling the `generateContent` method of the Gemini model.
 * The response is then logged to the console.
 */

import { GoogleGenAI } from "@google/genai";
import { StructuredOutputOptions } from './types.js';
import z, { ZodTypeAny } from "zod";
import { parseJsonResponse } from "./parse-json-response.js";
 import { zodToJsonSchema } from "zod-to-json-schema";

export function createGeminiProvider(apiKey: string, modelName: string) {

  const ai = new GoogleGenAI({
    apiKey
  });

  return {
    async visionExtract(
      imageBuffer: Buffer,
      mimeType: string,
      prompt: string
    ): Promise<string> {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            inlineData: {
              data: imageBuffer.toString("base64"),
              mimeType,
            },
          },
          { text: prompt },
        ],
      });

      return response.text ?? "";
    },

    async chatWithStructuredOutput<TSchema extends ZodTypeAny>(
      options: StructuredOutputOptions<TSchema>,
    ): Promise<z.infer<TSchema>> {

      const systemMsg = options.messages.find((m) => m.role === "system")?.content ?? "";
      const userMsg = options.messages.find((m) => m.role === "user")?.content ?? "";

         const schemaDescription = JSON.stringify(
          zodToJsonSchema(options.schema),
          null,
          2
        );

       const fullSystemInstruction = [
          systemMsg || "",
          "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation.",
          `\nRequired JSON schema:\n${schemaDescription}`,
        ].join("");

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userMsg,
        config: {
          systemInstruction: fullSystemInstruction,
        }
      });

      const text = response.text ?? "";
      const parsed = parseJsonResponse(text, options.schema, options.schemaName);

      if (!parsed) { 
        throw new Error(`Gemini structured output parse failed: ${options.schemaName}`);
      }

      return parsed;
    },
  };

}
