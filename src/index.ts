import { Provider } from "./types.ts";
import { createAnthropic } from "./providers/anthropic.ts";
import { createOpenAICompatible } from "./providers/openai-conpatible.ts";

const provider: Record<string, () => Provider> = {
  anthropic: createAnthropic,
  "vercel-openai": () =>
    createOpenAICompatible(
      "vercel-openai",
      "https://ai-gateway.vercel.sh/v1",
      process.env.AI_GATEWAY_API_KEY!,
      "openai/gpt-5.4-nano",
    ),
  "vercel-gemini": () =>
    createOpenAICompatible(
      "vercel-openai",
      "https://ai-gateway.vercel.sh/v1",
      process.env.AI_GATEWAY_API_KEY!,
      "google/gemini-2.5-flash",
    ),
  groq: () =>
    createOpenAICompatible(
      "groq",
      "https://api.groq.com/openai/v1",
      process.env.GROQ_API_KEY!,
      "qwen/qwen3.8-27b",
    ),
  "anthropic-openai": () =>
    createOpenAICompatible(
      "anthropic-openai",
      "https://api.anthropic.com/v1",
      process.env.POE_API_KEY!,
      "claude-sonnet-5",
    ),
};

export function getProvider(name: string): Provider {
  const create = provider[name];
  if (!create) {
    throw new Error("Something is wrong in index.ts");
  }
  return create();
}
