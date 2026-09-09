import { NextResponse } from "next/server";
import { z } from "zod";
import { callLLM } from "@/lib/llm";
import { generatePrompt } from "@/lib/prompts";
import { GenerateResultSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({ query: z.string().min(1) });

/** Free text -> objective filters + subjective fit rubric. */
export async function POST(req: Request) {
  try {
    const { query } = BodySchema.parse(await req.json());
    const result = await callLLM(generatePrompt(query), GenerateResultSchema, {
      label: "generate",
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
