"use client";

import type { Filters, Rubric } from "@/lib/schemas";
import type { RankedItem } from "@/lib/client";
import { Button, Card, Eyebrow } from "@/components/ui";
import { FiltersView, RubricView } from "@/components/Criteria";
import { ProfileCard } from "@/components/ProfileCard";

/** The satisfying end state: frozen filters, frozen rubric, final ranked shortlist. */
export function FrozenSummary({
  query,
  filters,
  rubric,
  ranked,
  onReset,
}: {
  query: string;
  filters: Filters;
  rubric: Rubric;
  ranked: RankedItem[];
  onReset: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="fadeup mb-8 flex flex-col items-center text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#cfe9e0] bg-[var(--accent-soft)] px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-bright)]" />
          <span className="eyebrow text-[var(--accent-ink)]">Search frozen</span>
        </div>
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Final shortlist</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
          Frozen from &ldquo;{query}&rdquo;
        </p>
        <div className="mt-4">
          <Button variant="subtle" onClick={onReset}>
            Start a new search
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <FiltersView filters={filters} />
          </Card>
          <Card className="p-5">
            <RubricView rubric={rubric} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <Eyebrow>Shortlist</Eyebrow>
              <span className="tnum text-xs text-[var(--muted)]">
                {ranked.length} {ranked.length === 1 ? "profile" : "profiles"}
              </span>
            </div>
            <span className="eyebrow">ranked by fit</span>
          </div>
          {ranked.map((item, i) => (
            <ProfileCard key={item.profile.id} item={item} index={i + 1} readOnly />
          ))}
        </div>
      </div>
    </div>
  );
}
