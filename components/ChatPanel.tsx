"use client";

import { useState } from "react";
import { Button, Eyebrow } from "@/components/ui";
import { ThinkingDots } from "@/components/states";

export interface ChatMessage {
  role: "recruiter" | "assistant";
  text: string;
}

/** The refinement console. Recruiter feedback on one side, the instrument's
 *  plain-English "here's what I changed" on the other. */
export function ChatPanel({
  messages,
  onSend,
  busy,
  disabled,
  pendingThumbsHint,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  busy: boolean;
  disabled: boolean;
  pendingThumbsHint?: string;
}) {
  const [value, setValue] = useState("");
  const canSend = value.trim().length > 0 && !busy && !disabled;

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-area flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            React to the results to tune the search. Try{" "}
            <span className="text-[var(--ink)]">
              &ldquo;2 and 4 are right, 1 is too junior&rdquo;
            </span>{" "}
            or use the ✓ / ✕ on each card, then send.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "recruiter" ? (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--accent)] px-3.5 py-2 text-sm text-white"
            >
              <span className="whitespace-pre-wrap leading-relaxed">{m.text}</span>
            </div>
          ) : (
            <div
              key={i}
              className="mr-auto max-w-[92%] rounded-2xl rounded-bl-sm border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--ink)]"
            >
              <Eyebrow className="mb-1 block text-[var(--accent-ink)]">What changed</Eyebrow>
              <span className="whitespace-pre-wrap leading-relaxed">{m.text}</span>
            </div>
          )
        )}
        {busy && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--muted)]">
            Tuning the search <ThinkingDots />
          </div>
        )}
      </div>

      {pendingThumbsHint && !busy && (
        <p className="mt-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-ink)]">
          {pendingThumbsHint}
        </p>
      )}

      <form
        className="mt-3 flex items-end gap-2 border-t border-[var(--hairline)] pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) {
            onSend(value.trim());
            setValue("");
          }
        }}
      >
        <textarea
          rows={2}
          value={value}
          disabled={disabled || busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canSend) {
              e.preventDefault();
              onSend(value.trim());
              setValue("");
            }
          }}
          placeholder={disabled ? "Search is frozen" : "Tell the instrument what to change..."}
          className="flex-1 resize-none rounded-lg border border-[var(--hairline-strong)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)] disabled:bg-[#f7f5f1]"
        />
        <Button type="submit" disabled={!canSend}>
          Send
        </Button>
      </form>
    </div>
  );
}
