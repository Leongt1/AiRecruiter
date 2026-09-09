import type { Filters, Rubric } from "@/lib/schemas";
import type { Profile } from "@/lib/profiles";

/**
 * All LLM prompts live here so they are easy to read and review. The JSON *shape*
 * is enforced separately via the AI SDK's structured output (the Zod schemas in
 * `lib/schemas.ts`), so these prompts focus on judgment, not on formatting.
 */

const COMPANY_TYPES_LINE =
  "company_type is exactly one of: startup, scaleup, enterprise, agency.";

const SHARED_RULES = `
Rules:
- Only use company types from this set: startup, scaleup, enterprise, agency.
- Objective filters are hard constraints applied literally in code, so keep them
  genuinely objective (skills, years, location, company background, title). Do NOT
  encode subjective preferences ("strong", "impressive") as filters - those belong
  in the rubric.
- Discipline words (frontend, backend, full-stack, mobile, iOS, Android, DevOps, ML,
  data, QA) name a role, not a skill. Put them in "titles", or decompose them into
  concrete skills (e.g. frontend -> React, CSS, TypeScript). Never put a bare
  discipline word in "skills".
- Leave an axis unconstrained (empty array or null) rather than inventing a limit
  the recruiter did not ask for. A narrow query should produce narrow filters; a
  vague one should stay broad.
- Years ranges: "4-7 years" -> min 4, max 7. "senior" alone is not a number, express
  it in the rubric instead unless the recruiter gives explicit years.
`.trim();

/** Step 1: free text -> objective filters + subjective rubric. */
export function generatePrompt(query: string): string {
  return `You are the sourcing engine for an AI recruiter. A recruiter has typed a
free-text description of who they want to hire. Turn it into two things:

1. objective filters - the hard, machine-checkable constraints.
2. a fit rubric - the subjective definition of what a *great* match looks like for
   this specific role, as weighted criteria that an LLM will later score candidates on.

${SHARED_RULES}
${COMPANY_TYPES_LINE}

Recruiter's request:
"""${query}"""`;
}

/** Step 2: score the filtered candidates against the rubric. */
export function scorePrompt(rubric: Rubric, filters: Filters, candidates: Profile[]): string {
  return `You are scoring candidates for a recruiter against a fit rubric. The
candidates below already passed the objective filters, so do not re-litigate those -
score how well each fits the *subjective* rubric.

Fit rubric:
${JSON.stringify(rubric, null, 2)}

For context, the objective filters that were applied:
${JSON.stringify(filters, null, 2)}

Score EVERY candidate from 0 to 100. Rank higher the ones that best satisfy the
high-weight criteria. For each candidate:
- explanation: one or two sentences, specific to THIS person, on why they fit or
  fall short. Reference real details from their record.
- matchedSignals: 2-4 short phrases quoting actual fields that drove the score, e.g.
  "AWS RDS in skills", "5 years experience", "startup background at NimbusPay".

Hard rule: every explanation and signal must be grounded in the candidate's actual
fields below. Never invent a skill, company, or number that is not present.

Candidates (the full record for each):
${JSON.stringify(candidates, null, 2)}`;
}

/** Step 3: adjust filters + rubric from recruiter feedback, and explain the change. */
export function refinePrompt(
  originalQuery: string,
  filters: Filters,
  rubric: Rubric,
  shown: Profile[],
  feedback: string
): string {
  return `You are refining a recruiter's live search based on their feedback. Adjust
the objective filters and/or the fit rubric so the next round better matches what they
want, then explain what you changed in plain language.

The recruiter's original request:
"""${originalQuery}"""

Current objective filters:
${JSON.stringify(filters, null, 2)}

Current fit rubric:
${JSON.stringify(rubric, null, 2)}

The profiles currently shown to the recruiter (they are reacting to these):
${JSON.stringify(
  shown.map((p) => ({
    id: p.id,
    name: p.name,
    current_title: p.current_title,
    years_experience: p.years_experience,
    location: p.location,
    current_company: p.current_company,
    current_company_type: p.current_company_type,
    skills: p.skills,
  })),
  null,
  2
)}

The recruiter's feedback:
"""${feedback}"""

${SHARED_RULES}

Interpret the feedback and translate it into concrete changes:
- "too junior" -> raise minYearsExperience or add an experience criterion.
- "keep the startup folks" / "not agencies" -> adjust companyTypes.
- "wrong city" -> adjust locations.
- Preferences about quality or focus -> adjust the rubric's criteria or weights.
Return the FULL updated filters and rubric (not a diff), plus changeSummary: a short,
specific note to the recruiter describing exactly what you changed and why. Address
them directly, e.g. "Raised the minimum experience to 5 years and dropped agency
backgrounds, since you flagged p03 as too junior."`;
}
