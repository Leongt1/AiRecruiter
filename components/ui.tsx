import type { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "solid" | "subtle" | "ghost" | "danger";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const base =
    "press inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] px-4 py-2";
  const variants = {
    primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-ink)] hover:shadow-sm",
    solid: "bg-[var(--ink)] text-white hover:bg-black hover:shadow-sm",
    subtle:
      "border border-[var(--hairline-strong)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent-ink)] hover:shadow-sm",
    ghost: "text-[var(--muted)] hover:bg-black/[0.04]",
    danger: "bg-[var(--danger)] text-white hover:brightness-95 hover:shadow-sm",
  } as const;
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function Badge({
  children,
  tone = "neutral",
  highlight = false,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "amber" | "slate";
  /** Jade ring to mark an item added in the latest refinement round. */
  highlight?: boolean;
}) {
  const tones = {
    neutral: "bg-[#f4f1ec] text-[#54514b] border-[var(--hairline)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[#cfe9e0]",
    amber: "bg-[var(--amber-soft)] text-[var(--amber)] border-[#ecdcc4]",
    slate: "bg-[#eef1f3] text-[#4a5560] border-[#dbe1e6]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        highlight && "ring-2 ring-[var(--accent-bright)] ring-offset-1 ring-offset-[var(--surface)]"
      )}
    >
      {children}
    </span>
  );
}

/** A value removed in the latest refinement round: struck through, muted claret. */
export function RemovedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[#eeccc4] bg-[var(--danger-soft)] px-2 py-0.5 text-xs font-medium text-[#b8877e] line-through">
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--hairline)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(20,20,20,0.03)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Mono, uppercase, tracked - the instrument's field labels. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("eyebrow", className)}>{children}</span>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="eyebrow">{children}</h3>;
}

function CheckGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0">
      <path
        d="M2.5 6.2 5 8.5 9.5 3.5"
        stroke="var(--accent-bright)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A grounded signal - verified against the profile, so it earns a check. */
export function VerifiedChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#cfe9e0] bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-ink)]">
      <CheckGlyph />
      {children}
    </span>
  );
}

function bandColor(score: number): string {
  if (score >= 80) return "var(--accent-bright)";
  if (score >= 60) return "var(--accent)";
  if (score >= 40) return "var(--amber)";
  return "var(--faint)";
}

/** The signature element: fit score as a signal-strength readout. */
export function SignalMeter({ score, animate = true }: { score: number; animate?: boolean }) {
  const rounded = Math.round(score);
  const filled = Math.max(1, Math.min(5, Math.round(score / 20)));
  const color = bandColor(score);
  const heights = [8, 11, 14, 17, 20];
  return (
    <div
      className="flex items-end gap-2"
      role="img"
      aria-label={`Fit score ${rounded} of 100`}
    >
      <div className="flex items-end gap-[3px]" aria-hidden>
        {heights.map((h, i) => (
          <span
            key={i}
            className={cn("w-[4px] rounded-sm", animate && "lockon")}
            style={{
              height: h,
              background: i < filled ? color : "var(--hairline-strong)",
              animationDelay: `${i * 55}ms`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-col items-start leading-none">
        <span className="tnum text-xl font-semibold" style={{ color }}>
          {rounded}
        </span>
        <span className="eyebrow mt-0.5">fit</span>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}
