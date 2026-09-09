import type { FilterStats } from "@/lib/filter";
import { Button, Card, Skeleton } from "@/components/ui";

export function ThinkingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

/** Designed loading state - a labelled status plus skeleton result cards. */
export function Thinking({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
        {label}
        <ThinkingDots />
      </div>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-7 w-7" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-28" />
              <div className="mt-4 flex gap-1.5">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="mt-4 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-3/4" />
            </div>
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

const CONSTRAINT_LABELS: Record<keyof Omit<FilterStats, "total" | "passingAll">, string> = {
  passingSkills: "Skills",
  passingYears: "Experience",
  passingLocation: "Location",
  passingCompanyType: "Company background",
  passingTitle: "Title",
};

/** Empty result set, explained: shows how each constraint narrows the pool so the
 *  recruiter can see which one to loosen. */
export function EmptyResults({ stats }: { stats: FilterStats }) {
  const rows = (
    Object.keys(CONSTRAINT_LABELS) as Array<keyof typeof CONSTRAINT_LABELS>
  ).map((key) => ({
    key,
    label: CONSTRAINT_LABELS[key],
    passing: stats[key],
  }));
  const tightest = rows.reduce((a, b) => (b.passing < a.passing ? b : a));

  return (
    <Card className="fadeup p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--amber-soft)] text-2xl">
        📡
      </div>
      <h3 className="font-display text-lg font-semibold">No profiles match all the filters</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
        The <span className="font-medium text-[var(--ink)]">{tightest.label}</span> constraint
        is the tightest - only {tightest.passing} of {stats.total} profiles pass it. Tell the
        console to loosen it, for example &ldquo;widen the location&rdquo; or &ldquo;drop the
        seniority requirement&rdquo;.
      </p>
      <div className="mx-auto mt-5 max-w-sm">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 py-1 text-sm">
            <span className="eyebrow w-36 text-left">{r.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#efece6]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${(r.passing / stats.total) * 100}%` }}
              />
            </div>
            <span className="tnum w-8 text-right text-[var(--muted)]">{r.passing}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Designed failure state for LLM/network errors, with a retry affordance. */
export function ErrorState({
  message,
  kind,
  onRetry,
}: {
  message: string;
  kind?: string;
  onRetry: () => void;
}) {
  const isRateLimit = kind === "rate_limit";
  return (
    <Card className="fadeup border-[#eeccc4] p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-2xl">
        {isRateLimit ? "⏳" : "⚠️"}
      </div>
      <h3 className="font-display text-lg font-semibold">
        {isRateLimit ? "Signal rate-limited" : "That didn't go through"}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{message}</p>
      <div className="mt-5">
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </Card>
  );
}
