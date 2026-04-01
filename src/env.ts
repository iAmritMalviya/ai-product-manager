import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  OPENAI_API_KEY:  z.string().optional(),
  PORT: z.coerce.number().default(3000),
  AI_PROVIDER: z.enum(["openai", "gemini"]).default("gemini"),
  GEMINI_API_KEY:  z.string().optional().default(""),
  GEMINI_AI_PROVIDER_MODEL_NAME: z.string().optional().default("gemini-2.0-flash")
}).superRefine((data, ctx) => {
    if (data.AI_PROVIDER === "openai" && !data.OPENAI_API_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "OPENAI_API_KEY required when AI_PROVIDER=openai", path: ["OPENAI_API_KEY"]
   });
    }
    if (data.AI_PROVIDER === "gemini" && !data.GEMINI_API_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GEMINI_API_KEY required when AI_PROVIDER=gemini", path: ["GEMINI_API_KEY"]
   });
    }
  });

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
