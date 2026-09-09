import type { RankedItem } from "@/lib/client";
import { Badge, Card, Eyebrow, SignalMeter, VerifiedChip, cn } from "@/components/ui";

export type Thumb = "up" | "down" | null;

function ThumbButton({
  active,
  tone,
  onClick,
  label,
  children,
}: {
  active: boolean;
  tone: "up" | "down";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "up"
      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
      : "bg-[var(--danger)] text-white border-[var(--danger)]";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "press flex h-8 w-8 items-center justify-center rounded-md border text-sm hover:scale-105",
        active
          ? activeCls
          : "border-[var(--hairline-strong)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
      )}
    >
      {children}
    </button>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-[var(--faint)]">
      /
    </span>
  );
}

export function ProfileCard({
  item,
  index,
  thumb,
  onThumb,
  readOnly = false,
}: {
  item: RankedItem;
  index: number;
  thumb?: Thumb;
  onThumb?: (t: Thumb) => void;
  readOnly?: boolean;
}) {
  const { profile: p } = item;
  return (
    <Card className="fadeup p-5">
      <div className="flex items-start gap-4">
        <span className="tnum mt-1 text-xs font-medium text-[var(--faint)]">
          {String(index).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display truncate text-[17px] font-semibold leading-tight">
                {p.name}
              </h3>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{p.current_title}</p>
            </div>
            <SignalMeter score={item.score} />
          </div>

          <div className="tnum mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[var(--muted)]">
            <span>{p.years_experience} yrs</span>
            <Dot />
            <span>{p.location}</span>
            <Dot />
            <span className="font-sans">
              {p.current_company}{" "}
              <span className="text-[var(--faint)]">({p.current_company_type})</span>
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.skills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">{item.explanation}</p>

          {item.matchedSignals.length > 0 && (
            <div className="mt-3.5">
              <Eyebrow>Verified signals</Eyebrow>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {item.matchedSignals.map((sig, i) => (
                  <VerifiedChip key={i}>{sig}</VerifiedChip>
                ))}
              </div>
            </div>
          )}

          {!readOnly && onThumb && (
            <div className="mt-4 flex items-center gap-2 border-t border-[var(--hairline)] pt-3">
              <span className="mr-1 text-xs text-[var(--muted)]">Does this match?</span>
              <ThumbButton
                active={thumb === "up"}
                tone="up"
                label={`${p.name} is a match`}
                onClick={() => onThumb(thumb === "up" ? null : "up")}
              >
                ✓
              </ThumbButton>
              <ThumbButton
                active={thumb === "down"}
                tone="down"
                label={`${p.name} is not a match`}
                onClick={() => onThumb(thumb === "down" ? null : "down")}
              >
                ✕
              </ThumbButton>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
