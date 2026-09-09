import type { Filters, Rubric } from "@/lib/schemas";
import { yearsLabel, type FiltersDiff, type RubricDiff, type ListDiff } from "@/lib/diff";
import { Badge, RemovedBadge, SectionLabel } from "@/components/ui";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

const Any = () => <span className="text-sm text-[var(--faint)]">Any</span>;

function UpdatedTag() {
  return (
    <span className="eyebrow inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-ink)]">
      Updated this round
    </span>
  );
}

/** A badge list that highlights items added and shows items removed in the last round. */
function DiffList({
  items,
  diff,
  tone,
}: {
  items: string[];
  diff?: ListDiff;
  tone?: "neutral" | "accent" | "slate";
}) {
  const added = new Set((diff?.added ?? []).map((x) => x.toLowerCase()));
  const removed = diff?.removed ?? [];
  if (items.length === 0 && removed.length === 0) return <Any />;
  return (
    <>
      {items.map((s) => (
        <Badge key={s} tone={tone} highlight={added.has(s.toLowerCase())}>
          {s}
        </Badge>
      ))}
      {removed.map((s) => (
        <RemovedBadge key={`removed-${s}`}>{s}</RemovedBadge>
      ))}
    </>
  );
}

/** The objective filters, readable at a glance; highlights what a refinement changed. */
export function FiltersView({ filters, diff }: { filters: Filters; diff?: FiltersDiff }) {
  const years = yearsLabel(filters.minYearsExperience, filters.maxYearsExperience);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SectionLabel>Objective filters</SectionLabel>
        {diff?.any && <UpdatedTag />}
      </div>

      <Row label="Skills">
        <DiffList items={filters.skills} diff={diff?.skills} tone="accent" />
      </Row>

      <Row label="Experience">
        {diff?.years.changed ? (
          <span className="tnum inline-flex items-center gap-1.5 text-sm">
            <span className="text-[var(--faint)] line-through">{diff.years.from}</span>
            <span aria-hidden className="text-[var(--muted)]">&rarr;</span>
            <Badge highlight>{diff.years.to}</Badge>
          </span>
        ) : (
          <Badge>{years}</Badge>
        )}
      </Row>

      <Row label="Location">
        <DiffList items={filters.locations} diff={diff?.locations} />
      </Row>

      <Row label="Company background">
        <DiffList items={filters.companyTypes} diff={diff?.companyTypes} tone="slate" />
      </Row>

      {(filters.titles.length > 0 || (diff?.titles.removed.length ?? 0) > 0) && (
        <Row label="Titles">
          <DiffList items={filters.titles} diff={diff?.titles} />
        </Row>
      )}
    </div>
  );
}

/** The subjective fit rubric with weighted criteria; highlights refinement changes. */
export function RubricView({ rubric, diff }: { rubric: Rubric; diff?: RubricDiff }) {
  const maxWeight = Math.max(...rubric.criteria.map((c) => c.weight), 0.0001);
  const added = new Set(diff?.addedCriteria ?? []);
  const weightChange = new Map((diff?.weightChanges ?? []).map((w) => [w.name, w]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SectionLabel>Fit rubric</SectionLabel>
        {diff?.any && <UpdatedTag />}
      </div>

      <p
        className={
          diff?.summaryChanged
            ? "border-l-2 border-[var(--accent-bright)] pl-3 text-sm leading-relaxed text-[var(--ink)]"
            : "text-sm leading-relaxed text-[var(--ink)]"
        }
      >
        {rubric.summary}
      </p>

      <div className="flex flex-col gap-3">
        {rubric.criteria.map((c) => {
          const change = weightChange.get(c.name);
          const isNew = added.has(c.name);
          return (
            <div key={c.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {c.name}
                  {isNew && (
                    <span className="ml-1.5 rounded bg-[var(--accent-soft)] px-1 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-ink)]">
                      new
                    </span>
                  )}
                </span>
                <span className="tnum flex items-center gap-1 text-xs text-[var(--muted)]">
                  {change && (
                    <span
                      className={change.to > change.from ? "text-[var(--accent-ink)]" : "text-[var(--danger)]"}
                    >
                      {change.to > change.from ? "▲" : "▼"}
                    </span>
                  )}
                  {Math.round(c.weight * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#efece6]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.weight / maxWeight) * 100}%`,
                    background: isNew ? "var(--accent-bright)" : "var(--accent)",
                  }}
                />
              </div>
              <p className="text-xs leading-relaxed text-[var(--muted)]">{c.description}</p>
            </div>
          );
        })}

        {diff && diff.removedCriteria.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-xs text-[var(--muted)]">Dropped:</span>
            {diff.removedCriteria.map((name) => (
              <RemovedBadge key={`removed-${name}`}>{name}</RemovedBadge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
