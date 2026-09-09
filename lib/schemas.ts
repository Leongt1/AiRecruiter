import { z } from "zod";

/**
 * Zod is the single source of truth for LLM output. Each schema is used twice:
 *  1. It is handed to the AI SDK's `generateObject`, which enforces structured output
 *     against it on the provider side (OpenAI / Google / Anthropic).
 *  2. The SDK validates the model's response against it before we ever see the value.
 *
 * We deliberately avoid string `min`/`regex` constraints on these schemas: provider
 * structured-output modes do not reliably support those keywords, and presence + enum
 * + numeric bounds are all we need to enforce structurally.
 */

export const COMPANY_TYPES = ["startup", "scaleup", "enterprise", "agency"] as const;

/** Objective, machine-applicable filters. Nulls mean "no constraint on this axis". */
export const FiltersSchema = z.object({
  skills: z.array(z.string()).describe("Required skills; a profile must have all of them"),
  minYearsExperience: z.number().nullable().describe("Inclusive lower bound, or null"),
  maxYearsExperience: z.number().nullable().describe("Inclusive upper bound, or null"),
  locations: z.array(z.string()).describe("Acceptable locations; match any. Empty = anywhere"),
  companyTypes: z
    .array(z.enum(COMPANY_TYPES))
    .describe("Acceptable company backgrounds (current or past); match any. Empty = any"),
  titles: z.array(z.string()).describe("Acceptable role titles; match any. Empty = any"),
});
export type Filters = z.infer<typeof FiltersSchema>;

/** Subjective fit rubric - what 'good' looks like for this specific search. */
export const RubricSchema = z.object({
  summary: z.string().describe("One or two sentences on what an ideal candidate looks like"),
  criteria: z
    .array(
      z.object({
        name: z.string().describe("Short label, e.g. 'Depth in PostgreSQL'"),
        description: z.string().describe("What earns a high score on this criterion"),
        weight: z.number().describe("Relative importance from 0 to 1"),
      })
    )
    .describe("The weighted things that make a candidate a strong fit"),
});
export type Rubric = z.infer<typeof RubricSchema>;

/** LLM output for the generate step. */
export const GenerateResultSchema = z.object({
  filters: FiltersSchema,
  rubric: RubricSchema,
});
export type GenerateResult = z.infer<typeof GenerateResultSchema>;

/** LLM output for the refine step: updated filters + rubric + a plain-English changelog. */
export const RefineResultSchema = z.object({
  filters: FiltersSchema,
  rubric: RubricSchema,
  changeSummary: z
    .string()
    .describe("Plain-English summary of exactly what changed and why, addressed to the recruiter"),
});
export type RefineResult = z.infer<typeof RefineResultSchema>;

/** One profile's LLM score. `matchedSignals` must quote real fields from the profile. */
export const ScoredProfileSchema = z.object({
  id: z.string(),
  score: z.number().describe("Fit score 0-100 against the rubric"),
  explanation: z
    .string()
    .describe("Short, specific reason this profile fits, citing real fields from it"),
  matchedSignals: z
    .array(z.string())
    .describe("Concrete fields that drove the score, e.g. 'AWS RDS in skills', '5 yrs experience'"),
});
export type ScoredProfile = z.infer<typeof ScoredProfileSchema>;

/** The LLM scores the whole filtered batch in one call and returns an array. */
export const ScoreResultSchema = z.object({
  scores: z.array(ScoredProfileSchema),
});
export type ScoreResult = z.infer<typeof ScoreResultSchema>;
