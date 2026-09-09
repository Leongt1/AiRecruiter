# Prompts

The assignment expects AI coding tools to be used, so for transparency this file records the
prompts I gave my AI pair-programmer while building this, roughly in order. They're reconstructed
from my working notes - lightly cleaned up, but they reflect how I actually drove the build:
spec and design first, then implementation, then the bugs I hit along the way and how I asked to
fix them.

> Note: the app's own LLM prompts (the ones the product sends at runtime) are a separate thing
> and live in [`lib/prompts.ts`](lib/prompts.ts).

---

## 1. Spec and design (before any code)

I started by handing over the full assignment brief (the PDF), the `profiles.json` sample data,
and screenshots of the flow and UI I had in mind, and asked for planning docs before writing code.

> "Here are two files - the Flexiple assignment PDF and the sample `profiles.json`. Read both.
> Before we write anything, help me plan the whole thing: a short user-spec of the product (the
> 5-step loop, the states, what's in and out of scope), a technical design doc (architecture,
> where state lives, how we talk to the LLM, how we handle failure), and a recommended tech
> stack with reasons. Keep me in the loop on every decision - I want to understand the why."

> "For the tech stack: I want one repo I can run with one command, the API key must stay
> server-side, and the frontend is half the grade so it has to be genuinely designed. Give me
> your recommendation and the trade-offs, don't just pick."

> "One rule I care about a lot: the objective constraints (skills, years, location, company
> type) should be applied deterministically in code, and only the subjective scoring/refinement
> should go to the model. Bake that into the design."

> "Also sketch the Loom walkthrough structure so I know what I'm building toward - we'll record
> it at the end."

**Outcome:** a build plan, the objective-in-code / subjective-in-LLM decision locked in, the
stack chosen (Next.js App Router + TypeScript + Tailwind + Zod + the Vercel AI SDK), and a
rough Loom outline.

---

## 2. Scaffolding and the LLM boundary

> "Scaffold the Next.js app (App Router, TypeScript, Tailwind). Set up Zod schemas as the single
> source of truth for the AI outputs - filters, rubric, scored profiles - so the same schema
> does validation and gives me the TypeScript types."

> "Build the LLM layer as one function that every call goes through: structured output validated
> against the Zod schema, a hard timeout, retries, and a typed error with a stable `kind` the UI
> can react to. Keep the three prompts (generate, score, refine) in one readable file."

> "Write the deterministic filter in code: skills, years range, location, company type (current
> or past), title. If nothing passes, also return per-constraint pass counts so the empty state
> can explain which filter was tightest."

**Outcome:** `lib/schemas.ts`, `lib/llm.ts`, `lib/prompts.ts`, `lib/filter.ts`, and the three
API routes.

---

## 3. Provider layer (OpenAI via the AI SDK)

The free Gemini tier was overloaded when I went to test, so I moved to OpenAI - and wanted it
provider-agnostic so switching again would be trivial.

> "Gemini's free tier is too crowded right now. Switch the LLM layer to OpenAI (`gpt-4o-mini`)
> but make it provider-agnostic through the Vercel AI SDK - a small provider module with a
> fallback chain built from whichever API keys are set, so swapping providers is a config
> change. Go through the code, fix everything the switch touches, and make it readable,
> maintainable, and scalable."

**Outcome:** `lib/provider.ts` with `getModel` / `getModelChain`, `callLLM` doing failover; a
couple of real bugs fixed in the process (the AI SDK exposes `statusCode` not `status`; the
Google provider needed the Gemini key mapped explicitly).

---

## 4. Frontend and designed states

> "Build the frontend as a state machine - search, generating, results, frozen - plus designed
> empty and error states. The filters and rubric are always visible; the recruiter refines in a
> chat panel. Show 4-5 profiles at a time, each with a fit score and grounded explanation."

> "Every state should feel designed: first load, two distinct thinking labels with skeletons, an
> empty state that explains which constraint is tightest, a friendly error state with retry, and
> a clean frozen summary. This is half the grade - treat it like it."

**Outcome:** `app/page.tsx` orchestrator plus the component set (search screen, criteria panels,
profile cards, chat, states, frozen summary).

---

## 5. Trust and visible refinement

After trying it, I wanted two things hardened: I didn't fully trust the explanations, and the
refinement didn't *show* what it changed.

> "Two gaps I want closed. First, trust: the explanations cite fields, but nothing verifies them
> - add a check that drops any signal that contradicts the actual profile, so a hallucinated
> company or wrong year count can never render. Second, visibility: when a refinement changes the
> filters, highlight exactly what changed - added values, removed values, `4-7 -> 5-7 yrs` - not
> just a silent swap."

> "While you're at it, I noticed during a refine the filters panel updates before the new results
> arrive, so for a second they contradict each other. Hold the old results behind a 're-ranking'
> state until the new ones land."

**Outcome:** `lib/ground.ts` (verifier), `lib/diff.ts` (the visible diff), and the re-ranking
guard in the page.

---

## 6. The visual identity - "Signal"

The default look was too generic, so I gave direction on the feel and screenshots of the layout
I wanted, and asked for a real identity.

> "The UI works but feels templated. I want a distinctive visual identity across the whole
> project - color, typography, layout, and motion. Give me a couple of directions grounded in
> what this product actually is (sourcing, measuring fit), with palettes and a signature element,
> and recommend one."

> "Go with the 'Signal' direction - the precision-instrument one. Build the full token system and
> restyle every screen to it. Make the fit score the signature element."

> "Here are screenshots of the flow and layout I want. Make all the clickable things show a
> pointer cursor, and add press/hover feedback that feels good - not just color changes."

**Outcome:** the "Signal" design system (tokens, Space Grotesk + mono figures, the signal-strength
meter, verified chips), the press feedback, and a full restyle.

---

## 7. Layout and responsive tweaks

I iterated on the layout with specific asks and screenshots.

> "Swap the columns: filters/rubric on the far left, the chat console in the middle, both equal
> width - the filters feel squished. Use more of the viewport width. Left and middle should scroll
> independently; the chat stays a fixed height with its own internal scroll."

> "Keep the 'Refine with these' button pinned while I scroll the results so I can reach it at the
> bottom too. And the top two buttons should be opposites - one dark, one light."

> "On small screens, move the top buttons to the right, and instead of the chat sitting at the
> very bottom, give me a floating chat button that opens a popup."

**Outcome:** the three-column instrument layout with independent scrolls, a sticky refine action,
opposite-styled header buttons, and a mobile floating-chat bottom sheet.

---

## 8. Bugs I found while testing (and asked to fix)

These are the real defects I hit and how I asked to fix them - each confirmed with a measurement
before changing code, then branched and PR'd.

> "I searched 'give me all the people who have frontend experience based in Bangalore' and got
> zero results, even though there are frontend engineers in Bangalore in the data. Figure out why
> before changing anything, then fix it."

Root cause: the model routed the discipline word "frontend" into the *skills* filter, where no
profile has a literal skill by that name. Fix: a deterministic discipline map in `lib/filter.ts`
(match by title or discipline-exclusive skill) plus a prompt nudge so the model routes discipline
words to titles. Verified frontend+Bangalore went 0 -> 2.

> "That RDS substring thing you flagged - let's fix it too. An 'RDS' search shouldn't match
> someone whose only skill is 'AWS'."

Root cause: `hasSkill` matched substrings in both directions, so a short skill satisfied a longer
query ("AWS" -> "AWS RDS", "SQL" -> "PostgreSQL"). Fix: make the substring match one-directional.
Verified false positives went 2 -> 0 for both, with aliases still working.

---

## 9. Cleanup and handoff

> "We're done with the features - fix any loose ends and do a code cleanup pass, and write me a
> guide for what to say in the Loom walkthrough."

**Outcome:** a docs-freshness pass on the README (so it matches the merged fixes and the
responsive layout), and a beat-by-beat Loom script.

---

## How I worked

- Planned the multi-file decisions up front; made small reversible changes directly.
- Confirmed every reported bug with a measurement before touching code, and re-measured after.
- Verified with `npm run build` / `npm run lint`, a scriptable smoke test
  ([`scripts/smoke.mjs`](scripts/smoke.mjs)), and by driving the real UI - not just types.
- Branched per change and opened a PR for each; kept the objective-in-code / subjective-in-LLM
  split intact throughout.
