# Flexiple - The Sourcing Refinement Loop

A small, focused slice of an AI recruiter. A recruiter types a hiring need in plain
English; the app uses a real LLM to turn it into **objective filters** and a
**subjective fit rubric**, applies the filters to a local talent pool of 48 profiles,
uses the LLM to score and rank the survivors with explanations grounded in each
profile, and then lets the recruiter **refine the search in conversation** until they
**freeze** a final shortlist.

## Run it locally

Prerequisites: Node 18+ (built on Node 22).

```bash
npm install
cp .env.example .env.local     # then paste your key into .env.local
npm run dev
```

Open http://localhost:3000.

### API key

The app talks to LLM providers through the Vercel AI SDK, so **any one** of these keys
is enough - set at least one in `.env.local`:

- **`OPENAI_API_KEY`** (default primary) - https://platform.openai.com/api-keys
- **`GEMINI_API_KEY`** (free, no card) - https://aistudio.google.com/apikey
- **`ANTHROPIC_API_KEY`** - https://console.anthropic.com

```
OPENAI_API_KEY=your_key_here
```

Providers form a fallback chain: the first one whose key is set is primary, the rest are
tried in order if it fails. Override the order with `LLM_PROVIDERS` (e.g.
`openai,google`), the model per provider with `OPENAI_MODEL` / `GEMINI_MODEL` /
`ANTHROPIC_MODEL`, and timeouts with `LLM_TIMEOUT_MS` (default `30000`). See
`.env.example` for all options.

Keys are read only on the server and are never sent to the browser or committed -
`.env.local` is gitignored.

### Smoke test (optional)

With the dev server running and a key set, verify the LLM pipeline end to end:

```bash
node scripts/smoke.mjs
```

It runs a real generate -> filter -> score against the sample query and prints the
filters, rubric, and top matches.

## How it works

The loop is five steps:

1. **Generate** - `POST /api/generate` sends the free text to the LLM and gets back
   `{ filters, rubric }`.
2. **Filter** - the objective filters are applied **deterministically in code**
   (`lib/filter.ts`), not by the LLM. Skills, years, location, company background, and
   title are exact constraints, so applying them in code is faster, free, and
   trustworthy. The matcher is hardened at the LLM seam: discipline words like
   "frontend"/"backend" are mapped to the right titles/skills even if the model routes
   them into the skills axis, and skill substring matching is one-directional so a short
   skill like "AWS" can't satisfy a query for "AWS RDS".
3. **Score** - `POST /api/search` sends the survivors + rubric to the LLM, which scores
   each 0-100 with a short explanation and `matchedSignals` that quote real fields. Each
   signal is then verified against the profile (`lib/ground.ts`) and any that contradict
   it are dropped, so every chip the recruiter sees is provably real.
4. **Refine** - `POST /api/refine` takes the recruiter's feedback plus the current
   filters and rubric, returns updated ones plus a plain-English `changeSummary`, and
   the client re-runs the search. The filters/rubric panel highlights exactly what the
   round changed (`4-7 -> 5-7 yrs`, added/removed badges). Repeats as often as wanted.
5. **Freeze** - a client-side transition to a read-only summary: final filters, final
   rubric, final ranked list.

### Key technical decisions

- **The server is stateless.** All session state (query, filters, rubric, shown
  profiles, chat) lives in client React state and is passed into each call. Each
  refinement is a pure `(currentState, feedback) -> newState`. This fits the "no
  persistence across sessions" rule and makes every round easy to reason about.
- **Zod is the single source of truth.** Every LLM output schema is a Zod schema
  (`lib/schemas.ts`) handed straight to the AI SDK's `generateObject`, which enforces
  structured output on the provider side and validates the response before we ever see
  it. No hand-rolled JSON parsing.
- **Provider-agnostic via the Vercel AI SDK.** `lib/provider.ts` builds a fallback chain
  (OpenAI / Google / Anthropic) from whichever keys are present. Swapping or adding a
  provider is a config change, not a rewrite - the rest of the app only knows `callLLM`.
- **Failure is handled in one place** (`lib/llm.ts`): a hard timeout (AbortSignal) on
  every call, SDK-level retries with backoff on rate limits / 5xx, and automatic
  failover to the next provider. Everything surfaces as a typed `LlmError` with a stable
  `kind` that the UI renders as a designed state - never a crash.
- **Explanations are grounded - and verified.** The scoring prompt requires every signal
  to cite actual fields, and `lib/ground.ts` then drops any signal that names a dataset
  skill/company or a years count the candidate does not actually have. Prompting gets the
  model close; the verifier makes "every chip is real" a guarantee, not a hope.
- **Refinement is made visible.** Beyond the plain-English `changeSummary`, the client
  diffs the previous vs new filters/rubric (`lib/diff.ts`) and highlights the change in
  place - added values ringed, removed values struck, `4-7 -> 5-7 yrs` - so the recruiter
  sees cause and effect at a glance and trusts that feedback landed.

### Prompts

All prompts live in **`lib/prompts.ts`** (`generatePrompt`, `scorePrompt`,
`refinePrompt`), kept readable and separate from formatting concerns - the JSON shape is
enforced by structured output, so the prompts focus on judgment.

## Design language - "Signal"

The UI is styled as a precision sourcing instrument: warm paper, graphite ink, and a
single jade accent used with restraint. Mono eyebrows and tabular figures (Geist Mono)
label and carry every measured value; Space Grotesk sets the headlines. The signature
element is the **fit score as a signal-strength meter**, and grounded `matchedSignals`
render as **verified chips** - turning the trust guarantee into the visual hero. During a
refinement the results hold behind a "re-ranking" state so the shown candidates never
contradict the already-updated filters. The three-column instrument view (filters, refine
console, results) is responsive: each column scrolls independently on desktop, and on
small screens the console collapses into a floating chat button that opens a bottom sheet.

## Project structure

```
app/
  page.tsx              # client orchestrator + state machine
  api/generate|search|refine/route.ts
components/             # SearchScreen, Criteria, ProfileCard, ChatPanel,
                        # FrozenSummary, states (thinking/empty/error), ui primitives
lib/
  schemas.ts            # Zod schemas (filters, rubric, scores) = single source of truth
  llm.ts                # callLLM: structured output, timeout, retry, provider failover
  provider.ts           # provider abstraction + key-based fallback chain
  prompts.ts            # the three LLM prompts
  filter.ts             # deterministic objective filtering + per-constraint stats
  ground.ts             # verifies matchedSignals against the profile (trust guardrail)
  diff.ts               # filters/rubric diff for the visible "what changed" highlight
  profiles.ts           # loads data/profiles.json as the talent pool
  client.ts             # typed browser -> API client
data/profiles.json      # the supplied 48-profile sample
scripts/smoke.mjs       # optional end-to-end pipeline check
```

## Decisions: what I prioritised and cut

**Prioritised**
- The loop working end to end with real LLM calls, and refinement that *visibly*
  responds to feedback (the `changeSummary` message + updated filters/rubric make the
  cause and effect legible).
- Reliability of the LLM boundary: structured output + validation + timeout + retry +
  provider failover, all behind one `callLLM`.
- Designed states, since the frontend is half the assignment: first load, two distinct
  thinking labels, skeletons, an *explained* empty state (which constraint is tightest),
  a friendly error state with retry, and a clean frozen summary.
- Grounded explanations, so a recruiter can trust why each profile surfaced.

**Cut (deliberately, given the time box)**
- **Inline editing of filters/rubric.** They are always visible and fully readable, but
  changes are driven through the chat rather than direct manipulation. Refinement via
  natural language is the core of the assignment; direct editing is additive.
- **Persistence, auth, multiple roles** - explicitly out of scope.
- **Streaming responses.** Calls are fast enough that designed skeletons read better than
  partial token streams for this flow.
- **A test suite.** With three hours I invested in the working experience and manual +
  smoke verification; the deterministic filter (`lib/filter.ts`) is the piece most worth
  unit tests next.
