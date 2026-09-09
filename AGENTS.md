# AGENTS.md

Context for anyone (human or agent) working on this repo next.

## What this is

A 3-hour take-home: the Flexiple "sourcing refinement loop". See `README.md` for the
full picture, setup, and the decisions log. The assignment brief is in `_brief/`.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4. Vercel AI SDK (`ai` +
`@ai-sdk/openai|google|anthropic`) for the LLM layer. Zod for schemas/validation.
No DB, no auth - out of scope by design.

## Where things live

- LLM boundary: `lib/llm.ts` (`callLLM`: structured output via `generateObject`,
  timeout, retry, provider failover).
- Provider abstraction + fallback chain: `lib/provider.ts`. Add a provider or change
  order/model via env (`LLM_PROVIDERS`, `OPENAI_MODEL`, `GEMINI_MODEL`, ...).
- Prompts: `lib/prompts.ts` (graded artifact - keep readable).
- Schemas (single source of truth): `lib/schemas.ts`.
- Deterministic objective filtering: `lib/filter.ts`.
- API routes: `app/api/{generate,search,refine}/route.ts`.
- UI: `app/page.tsx` (state machine) + `components/`.

## Conventions

- The server is stateless; session state lives in the client and is passed into each
  call. Keep it that way.
- Objective constraints are applied in code, not the LLM. Only subjective scoring +
  refinement go to the model.
- Use `-` not em/en dashes in all copy. No AI attribution in commits/PRs/docs.
- Verify against installed types before writing against a library.

## Verify

`npm run build`, `npm run lint`, then `node scripts/smoke.mjs` with the dev server up
and at least one provider key set (`OPENAI_API_KEY` or `GEMINI_API_KEY`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
