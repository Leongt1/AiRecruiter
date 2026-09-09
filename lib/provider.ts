import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Provider abstraction for the LLM layer. Adding a new provider is a matter of
 * extending these three maps - the rest of the app talks to `getModel` /
 * `getModelChain` and never imports a provider SDK directly.
 */

export type ProviderName = "openai" | "google" | "anthropic";

export interface ModelConfig {
  provider: ProviderName;
  model: string;
}

/**
 * Which env var(s) hold each provider's API key. Google is mapped to GEMINI_API_KEY
 * first (falling back to the SDK's own GOOGLE_GENERATIVE_AI_API_KEY) so a single
 * Gemini key from AI Studio just works without renaming anything.
 */
const API_KEY_ENV: Record<ProviderName, string[]> = {
  openai: ["OPENAI_API_KEY"],
  google: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
};

const DEFAULT_MODEL: Record<ProviderName, string> = {
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-latest",
};

const MODEL_ENV: Record<ProviderName, string> = {
  openai: "OPENAI_MODEL",
  google: "GEMINI_MODEL",
  anthropic: "ANTHROPIC_MODEL",
};

function keyFor(provider: ProviderName): string | undefined {
  return API_KEY_ENV[provider].map((name) => process.env[name]).find(Boolean);
}

export function hasKey(provider: ProviderName): boolean {
  return Boolean(keyFor(provider));
}

/** Build a language model for a provider, passing the key explicitly so provider
 *  selection never depends on the SDK's default env-var names. */
export function getModel({ provider, model }: ModelConfig): LanguageModel {
  const apiKey = keyFor(provider);
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * The ordered fallback chain, filtered to providers whose key is actually present.
 * The first entry is primary; the rest are tried in order if it fails.
 *
 * Order can be overridden with LLM_PROVIDERS, e.g. "openai,google". Each model can
 * be overridden with OPENAI_MODEL / GEMINI_MODEL / ANTHROPIC_MODEL.
 */
export function getModelChain(): ModelConfig[] {
  const order = (process.env.LLM_PROVIDERS ?? "openai,google,anthropic")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ProviderName => s in DEFAULT_MODEL);

  return order
    .filter(hasKey)
    .map((provider) => ({
      provider,
      model: process.env[MODEL_ENV[provider]] ?? DEFAULT_MODEL[provider],
    }));
}
