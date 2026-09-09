"use client";

import { useMemo, useState } from "react";
import type { Filters, Rubric } from "@/lib/schemas";
import type { FilterStats } from "@/lib/filter";
import { api, ApiError, type RankedItem } from "@/lib/client";
import { diffFilters, diffRubric, type FiltersDiff, type RubricDiff } from "@/lib/diff";
import { SearchScreen } from "@/components/SearchScreen";
import { FiltersView, RubricView } from "@/components/Criteria";
import { ProfileCard, type Thumb } from "@/components/ProfileCard";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { FrozenSummary } from "@/components/FrozenSummary";
import { Thinking, ThinkingDots, EmptyResults, ErrorState } from "@/components/states";
import { Button, Card, Eyebrow } from "@/components/ui";

type Phase = "search" | "generating" | "results" | "frozen";
const BATCH = 5;

export default function Home() {
  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [ranked, setRanked] = useState<RankedItem[]>([]);
  const [stats, setStats] = useState<FilterStats | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, Thumb>>({});

  // What the latest refinement round changed, so the panel can show it at a glance.
  const [filtersDiff, setFiltersDiff] = useState<FiltersDiff | null>(null);
  const [rubricDiff, setRubricDiff] = useState<RubricDiff | null>(null);

  // On small screens the chat lives in a popup sheet rather than a column.
  const [chatOpen, setChatOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Generating filters and rubric");
  const [fatalError, setFatalError] = useState<{ message: string; kind: string } | null>(null);
  const [refineError, setRefineError] = useState<{ message: string; kind: string } | null>(null);
  const [lastFeedback, setLastFeedback] = useState("");

  const visible = useMemo(() => ranked.slice(0, visibleCount), [ranked, visibleCount]);
  const shownIds = useMemo(() => visible.map((i) => i.profile.id), [visible]);
  const thumbCount = useMemo(
    () => Object.values(thumbs).filter(Boolean).length,
    [thumbs]
  );

  // --- Initial search: free text -> filters + rubric -> filter + score ---------
  async function runInitialSearch(q: string) {
    setQuery(q);
    setPhase("generating");
    setFatalError(null);
    setChat([]);
    setThumbs({});
    setVisibleCount(BATCH);
    setFiltersDiff(null); // a fresh search has no "previous" to diff against
    setRubricDiff(null);
    try {
      setLoadingLabel("Generating filters and rubric");
      const gen = await api.generate(q);
      setFilters(gen.filters);
      setRubric(gen.rubric);

      setLoadingLabel("Scoring profiles against the rubric");
      const res = await api.search(gen.filters, gen.rubric);
      setRanked(res.ranked);
      setStats(res.stats);
      setPhase("results");
    } catch (e) {
      const err = e as ApiError;
      setFatalError({ message: err.message, kind: err.kind });
      setPhase("results"); // render the error inside the results shell
    }
  }

  // --- Refinement round: adjust filters/rubric, then re-run search --------------
  async function performRefine(feedback: string) {
    if (!filters || !rubric) return;
    setBusy(true);
    setRefineError(null);
    setLastFeedback(feedback);
    // Capture the pre-refine state so we can show exactly what this round changed.
    const prevFilters = filters;
    const prevRubric = rubric;
    try {
      const r = await api.refine({ query, filters, rubric, feedback, shownProfileIds: shownIds });
      setFilters(r.filters);
      setRubric(r.rubric);
      setFiltersDiff(diffFilters(prevFilters, r.filters));
      setRubricDiff(diffRubric(prevRubric, r.rubric));
      setChat((prev) => [...prev, { role: "assistant", text: r.changeSummary }]);

      const res = await api.search(r.filters, r.rubric);
      setRanked(res.ranked);
      setStats(res.stats);
      setThumbs({});
      setVisibleCount(BATCH);
    } catch (e) {
      const err = e as ApiError;
      setRefineError({ message: err.message, kind: err.kind });
    } finally {
      setBusy(false);
    }
  }

  function submitFeedback(feedback: string) {
    setChat((prev) => [...prev, { role: "recruiter", text: feedback }]);
    performRefine(feedback);
  }

  function refineFromThumbs() {
    const up = visible.filter((i) => thumbs[i.profile.id] === "up").map((i) => i.profile.name);
    const down = visible.filter((i) => thumbs[i.profile.id] === "down").map((i) => i.profile.name);
    const parts: string[] = [];
    if (up.length) parts.push(`These are good matches: ${up.join(", ")}.`);
    if (down.length) parts.push(`These are not a fit: ${down.join(", ")}.`);
    if (parts.length) submitFeedback(parts.join(" "));
  }

  function reset() {
    setPhase("search");
    setQuery("");
    setFilters(null);
    setRubric(null);
    setRanked([]);
    setStats(null);
    setChat([]);
    setThumbs({});
    setFatalError(null);
    setRefineError(null);
    setFiltersDiff(null);
    setRubricDiff(null);
  }

  // --- Render ------------------------------------------------------------------
  if (phase === "search") {
    return (
      <main className="flex-1">
        <SearchScreen onSubmit={runInitialSearch} busy={false} />
      </main>
    );
  }

  if (phase === "frozen" && filters && rubric) {
    return (
      <main className="flex-1">
        <FrozenSummary
          query={query}
          filters={filters}
          rubric={rubric}
          ranked={ranked}
          onReset={reset}
        />
      </main>
    );
  }

  const generating = phase === "generating";
  const thumbsHint =
    thumbCount > 0 ? `${thumbCount} marked - press "Refine with these" or add a note.` : undefined;

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col px-4 sm:px-6 lg:h-[100dvh]">
      {/* Instrument header */}
      <header className="shrink-0 border-b border-[var(--hairline)] py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Eyebrow className="text-[var(--accent-ink)]">Flexiple / sourcing</Eyebrow>
              <span className="eyebrow inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]" />
                active
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl truncate text-sm text-[var(--ink)]">
              &ldquo;{query}&rdquo;
            </p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="subtle" onClick={reset}>
              New search
            </Button>
            <Button
              variant="solid"
              onClick={() => setPhase("frozen")}
              disabled={generating || busy || ranked.length === 0}
            >
              Freeze search
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 py-6 lg:grid-cols-[1fr_1fr_1.5fr]">
        {/* Refine console - far left on desktop, fixed height, internal scroll.
            Hidden on small screens, where it opens as a popup sheet instead. */}
        <aside className="hidden min-h-0 lg:order-2 lg:block">
          <Card className="flex h-full flex-col p-5">
            <h2 className="font-display mb-3 shrink-0 text-sm font-semibold">Refine console</h2>
            <div className="min-h-0 flex-1">
              <ChatPanel
                messages={chat}
                onSend={submitFeedback}
                busy={busy}
                disabled={generating || !!fatalError}
                pendingThumbsHint={thumbsHint}
              />
            </div>
          </Card>
        </aside>

        {/* Filters + rubric - independent scroll */}
        <aside className="scroll-area order-2 flex min-h-0 flex-col gap-5 lg:order-1 lg:overflow-y-auto lg:pr-2">
          {generating || !filters || !rubric ? (
            <Card className="p-5">
              <div className="shimmer h-4 w-32 rounded" />
              <div className="mt-4 space-y-2">
                <div className="shimmer h-5 w-full rounded" />
                <div className="shimmer h-5 w-3/4 rounded" />
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <FiltersView filters={filters} diff={filtersDiff ?? undefined} />
              </Card>
              <Card className="p-5">
                <RubricView rubric={rubric} diff={rubricDiff ?? undefined} />
              </Card>
            </>
          )}
        </aside>

        {/* Results - independent scroll */}
        <section className="scroll-area order-1 min-h-0 min-w-0 lg:order-3 lg:overflow-y-auto lg:pr-2">
          {fatalError ? (
            <ErrorState
              message={fatalError.message}
              kind={fatalError.kind}
              onRetry={() => runInitialSearch(query)}
            />
          ) : generating ? (
            <Thinking label={loadingLabel} />
          ) : ranked.length === 0 && stats ? (
            <EmptyResults stats={stats} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="sticky top-0 z-10 -mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-transparent bg-[var(--paper)] py-2 has-[button]:border-[var(--hairline)]">
                <div className="flex items-baseline gap-2">
                  <Eyebrow>Top matches</Eyebrow>
                  <span className="tnum text-xs text-[var(--muted)]">
                    {ranked.length} passed filters
                  </span>
                </div>
                {thumbCount > 0 && (
                  <Button onClick={refineFromThumbs} disabled={busy}>
                    Refine with these ({thumbCount})
                  </Button>
                )}
              </div>

              {refineError && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#eeccc4] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[#8a4636]">
                  <span>{refineError.message}</span>
                  <Button variant="danger" onClick={() => performRefine(lastFeedback)}>
                    Retry
                  </Button>
                </div>
              )}

              {/* While refining, the filters/rubric already show the new state; hold the
                  stale results behind a re-ranking notice so the two never contradict. */}
              {busy && (
                <div className="flex items-center gap-2 rounded-lg border border-[#cfe9e0] bg-[var(--accent-soft)] px-4 py-2.5 text-sm text-[var(--accent-ink)]">
                  Re-ranking against the updated filters
                  <ThinkingDots />
                </div>
              )}

              <div
                className={
                  busy
                    ? "pointer-events-none flex flex-col gap-4 opacity-40 transition-opacity"
                    : "flex flex-col gap-4 transition-opacity"
                }
              >
                {visible.map((item, i) => (
                  <ProfileCard
                    key={item.profile.id}
                    item={item}
                    index={i + 1}
                    thumb={thumbs[item.profile.id] ?? null}
                    onThumb={(t) => setThumbs((prev) => ({ ...prev, [item.profile.id]: t }))}
                  />
                ))}

                {ranked.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount((c) => c + BATCH)}
                    className="mx-auto text-sm text-[var(--muted)] underline decoration-dotted underline-offset-4 hover:text-[var(--accent-ink)]"
                  >
                    Show {Math.min(BATCH, ranked.length - visibleCount)} more
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Small screens: floating button + popup sheet instead of a chat column. */}
      <button
        onClick={() => setChatOpen(true)}
        aria-label="Open refine console"
        className="press fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg hover:scale-105 hover:bg-[var(--accent-ink)] lg:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        {busy && (
          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[var(--accent-bright)] ring-2 ring-white" />
        )}
      </button>

      {chatOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setChatOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[82vh] flex-col rounded-t-2xl border-t border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Refine console</h2>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close refine console"
                className="press flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel
                messages={chat}
                onSend={submitFeedback}
                busy={busy}
                disabled={generating || !!fatalError}
                pendingThumbsHint={thumbsHint}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
