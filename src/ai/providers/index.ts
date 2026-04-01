import { env } from "../../env.js";
import { createGeminiProvider } from "./gemini.js";
import { AIProvider } from "./types.js";

async function createAiProvider (): Promise<AIProvider> {
  if (env.AI_PROVIDER === "gemini") {
    return createGeminiProvider(env.GEMINI_API_KEY, env.GEMINI_AI_PROVIDER_MODEL_NAME);
  } else if (env.AI_PROVIDER === "openai") {
    // TODO will implement later for openai provider right now we have gemini 
    throw new Error("OpenAI provider not implemented yet");
  } else {
    throw new Error(`Unsupported AI provider: ${env.AI_PROVIDER}`);
  }
}

let _providerPromise: Promise<AIProvider> | null = null;

export function getAIProvider(): Promise<AIProvider> {
  if (!_providerPromise) {
    _providerPromise = createAiProvider();
  }
  return _providerPromise;
}