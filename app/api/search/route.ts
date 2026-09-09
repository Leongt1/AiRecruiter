import { NextResponse } from "next/server";
import { z } from "zod";
import { callLLM } from "@/lib/llm";
import { scorePrompt } from "@/lib/prompts";
import { FiltersSchema, RubricSchema, ScoreResultSchema } from "@/lib/schemas";
import { filterProfiles } from "@/lib/filter";
import { groundSignals } from "@/lib/ground";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({
  filters: FiltersSchema,
  rubric: RubricSchema,
});

/** Apply objective filters locally, then score + rank the survivors against the rubric. */
export async function POST(req: Request) {
  try {
    const { filters, rubric } = BodySchema.parse(await req.json());
    const { passing, stats } = filterProfiles(filters);

    // Empty result is a designed state, not an error: return the stats so the UI can
    // explain which constraint is doing the excluding.
    if (passing.length === 0) {
      return NextResponse.json({ ranked: [], totalPassed: 0, stats });
    }

    const { scores } = await callLLM(
      scorePrompt(rubric, filters, passing),
      ScoreResultSchema,
      { label: "score" }
    );

    const byId = new Map(scores.map((s) => [s.id, s]));
    const ranked = passing
      .map((profile) => {
        const s = byId.get(profile.id);
        return {
          profile,
          score: s?.score ?? 0,
          explanation: s?.explanation ?? "Not scored by the model in this round.",
          // Drop any signal that contradicts the profile so every chip shown is real.
          matchedSignals: groundSignals(profile, s?.matchedSignals ?? []),
        };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ ranked, totalPassed: passing.length, stats });
  } catch (err) {
    return errorResponse(err);
  }
}
