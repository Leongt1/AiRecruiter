"use client";

import { useState } from "react";
import { Button, Eyebrow } from "@/components/ui";

const EXAMPLE =
  "RDS developers with 4-7 years of experience who have worked at startups, for a role based in Bangalore";

function SignalMark() {
  const heights = [7, 10, 13, 16];
  return (
    <span className="flex items-end gap-[3px]" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{ height: h, background: i === 3 ? "var(--accent-bright)" : "var(--accent)" }}
        />
      ))}
    </span>
  );
}

export function SearchScreen({
  onSubmit,
  busy,
}: {
  onSubmit: (query: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState("");
  const canSubmit = value.trim().length > 0 && !busy;

  return (
    <div className="mx-auto flex min-h-[78vh] max-w-2xl flex-col justify-center px-6">
      <div className="fadeup">
        <div className="mb-6 inline-flex items-center gap-2">
          <SignalMark />
          <Eyebrow>Flexiple / sourcing</Eyebrow>
        </div>

        <h1 className="font-display text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[42px]">
          Describe who you
          <br />
          want to hire.
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
          Type it the way you would a search box. The instrument turns it into objective
          filters and a fit rubric, then ranks the talent pool - and tunes as you react.
        </p>
      </div>

      <form
        className="fadeup mt-8"
        style={{ animationDelay: "80ms" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit(value.trim());
        }}
      >
        <div className="rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] p-1.5 shadow-[0_1px_3px_rgba(20,20,20,0.05)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
          <textarea
            autoFocus
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
                e.preventDefault();
                onSubmit(value.trim());
              }
            }}
            placeholder="e.g. Senior backend engineers strong in PostgreSQL, 5+ years, startup background..."
            className="w-full resize-none bg-transparent p-3 text-[15px] leading-relaxed outline-none placeholder:text-[var(--faint)]"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <span className="eyebrow hidden sm:inline">Ctrl + Enter to run</span>
            <Button type="submit" disabled={!canSubmit} className="ml-auto px-5">
              {busy ? "Acquiring..." : "Run search"}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setValue(EXAMPLE)}
          className="mt-4 text-left text-xs text-[var(--muted)] transition-colors hover:text-[var(--accent-ink)]"
        >
          <span className="eyebrow mr-2 text-[var(--accent-ink)]">try</span>
          {EXAMPLE}
        </button>
      </form>
    </div>
  );
}
