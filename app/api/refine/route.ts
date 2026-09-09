import { NextResponse } from "next/server";
import { z } from "zod";
import { callLLM } from "@/lib/llm";
import { refinePrompt } from "@/lib/prompts";
import { FiltersSchema, RubricSchema, RefineResultSchema } from "@/lib/schemas";
import { getProfilesByIds } from "@/lib/profiles";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({
  query: z.string(),
  filters: FiltersSchema,
  rubric: RubricSchema,
  feedback: z.string().min(1),
  shownProfileIds: z.array(z.string()),
});

/** Adjust filters + rubric from recruiter feedback and explain the change. The client
 *  then re-runs /api/search with the returned filters + rubric. */
export async function POST(req: Request) {
  try {
    const { query, filters, rubric, feedback, shownProfileIds } = BodySchema.parse(
      await req.json()
    );
    const shown = getProfilesByIds(shownProfileIds);
    const result = await callLLM(
      refinePrompt(query, filters, rubric, shown, feedback),
      RefineResultSchema,
      { label: "refine" }
    );
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
