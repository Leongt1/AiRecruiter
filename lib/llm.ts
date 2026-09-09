import {
  generateObject,
  APICallError,
  LoadAPIKeyError,
  NoObjectGeneratedError,
  NoSuchModelError,
} from "ai";
import { z } from "zod";

import { getModel, getModelChain, type ModelConfig } from "./provider";

/**
 * The single choke point for every LLM call. Everything the assignment cares about
 * on the reliability axis lives here:
 *  - structured output: the caller's Zod schema is enforced natively by the AI SDK
 *    (`generateObject`) and the result is already validated against it.
 *  - timeouts: every call is bounded by an AbortSignal deadline.
 *  - transient errors (rate limits / 5xx): retried by the SDK, then failed over to
 *    the next configured provider.
 *  - typed failures: callers/routes get an LlmError with a stable `kind` and a
 *    recruiter-friendly message, so the UI can render a designed error state.
 */

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? process.env.GEMINI_TIMEOUT_MS ?? 30000);
// Retries the SDK performs per provider on retryable errors (429/5xx) before we fail over.
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES ?? 1);

export type LlmErrorKind =
  | "no_key"
  | "timeout"
  | "rate_limit"
  | "server"
  | "model_not_found"
  | "invalid_output"
  | "unknown";

export class LlmError extends Error {
  kind: LlmErrorKind;
  /** Safe to show a recruiter. */
  userMessage: string;
  constructor(kind: LlmErrorKind, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "LlmError";
    this.kind = kind;
    this.userMessage = userMessage;
    if (cause) this.cause = cause;
  }
}

function isAbort(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? "";
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return name === "TimeoutError" || name === "AbortError" || msg.includes("aborted");
}

/** Map any thrown error into a typed LlmError with a user-facing message. */
function classify(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (isAbort(err)) {
    return new LlmError("timeout", "The model took too long to respond. Please retry.", err);
  }
  if (LoadAPIKeyError.isInstance(err)) {
    return new LlmError("no_key", "The AI provider API key is missing or invalid.", err);
  }
  if (NoSuchModelError.isInstance(err)) {
    return new LlmError("model_not_found", "The configured AI model is not available.", err);
  }
  if (NoObjectGeneratedError.isInstance(err)) {
    return new LlmError(
      "invalid_output",
      "The model returned data we couldn't read. Please try again.",
      err
    );
  }
  if (APICallError.isInstance(err)) {
    const status = err.statusCode;
    if (status === 401 || status === 403) {
      return new LlmError("no_key", "The AI provider rejected the API key.", err);
    }
    if (status === 404) {
      return new LlmError("model_not_found", "The configured AI model is not available.", err);
    }
    if (status === 429) {
      return new LlmError(
        "rate_limit",
        "The model is rate-limited right now. Wait a few seconds and retry.",
        err
      );
    }
    if (status && status >= 500) {
      return new LlmError(
        "server",
        "The model service is temporarily unavailable. Please retry.",
        err
      );
    }
  }
  return new LlmError("unknown", "Something went wrong talking to the model. Please retry.", err);
}

/** Whether it is worth failing over to the next provider for this kind of error. */
function shouldFailover(kind: LlmErrorKind): boolean {
  return (
    kind === "rate_limit" ||
    kind === "server" ||
    kind === "timeout" ||
    kind === "model_not_found" ||
    kind === "no_key" ||
    kind === "invalid_output"
  );
}

export interface CallOptions {
  /** Short label used for logs and as the structured-output schema name, e.g. "generate". */
  label?: string;
}

/**
 * Call the LLM and get back a value guaranteed to satisfy `schema`. Tries each
 * configured provider in order and throws a typed LlmError if they all fail.
 */
export async function callLLM<T>(
  prompt: string,
  schema: z.ZodType<T>,
  opts: CallOptions = {}
): Promise<T> {
  const chain = getModelChain();
  if (chain.length === 0) {
    throw new LlmError(
      "no_key",
      "No AI provider is configured. Set OPENAI_API_KEY (or GEMINI_API_KEY) in .env.local and restart."
    );
  }

  const label = opts.label ?? "call";
  let lastError: LlmError | null = null;

  for (const config of chain) {
    try {
      return await callOnce(prompt, schema, config, label);
    } catch (err) {
      const e = classify(err);
      lastError = e;
      console.error(`[llm:${label}] ${config.provider}/${config.model} -> ${e.kind}`);
      if (!shouldFailover(e.kind)) throw e;
      // otherwise try the next provider in the chain
    }
  }

  throw lastError ?? new LlmError("unknown", "All configured AI providers failed. Please retry.");
}

async function callOnce<T>(
  prompt: string,
  schema: z.ZodType<T>,
  config: ModelConfig,
  label: string
): Promise<T> {
  const { object } = await generateObject({
    model: getModel(config),
    schema,
    schemaName: label,
    prompt,
    maxRetries: MAX_RETRIES,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return object;
}
