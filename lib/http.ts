import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LlmError, type LlmErrorKind } from "@/lib/llm";

const STATUS: Record<LlmErrorKind, number> = {
  no_key: 500,
  timeout: 504,
  rate_limit: 429,
  server: 503,
  model_not_found: 404,
  invalid_output: 502,
  unknown: 500,
};

/** Turn any thrown error into a clean JSON envelope the frontend knows how to render. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof LlmError) {
    return NextResponse.json(
      { error: { kind: err.kind, message: err.userMessage } },
      { status: STATUS[err.kind] }
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { kind: "bad_request", message: "The request body was not in the expected shape." } },
      { status: 400 }
    );
  }
  // Full detail goes to the server log; the client gets a clean, non-leaky message.
  console.error("[api] unexpected error", err);
  return NextResponse.json(
    { error: { kind: "unknown", message: "Unexpected server error. Please try again." } },
    { status: 500 }
  );
}
