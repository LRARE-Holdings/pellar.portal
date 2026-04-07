"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Click → opens an inline popover with an optional "what should I say?"
 * textarea → user types context (or skips) → POSTs to /api/drafts/generate
 * with personal_context → opens the resulting draft in the drawer.
 *
 * The personal_context is the difference between a generic AI cold draft
 * and one that anchors on a real specific reason for getting in touch.
 * Optional, but the popover nudges Alex to use it.
 *
 * Disabled if the deal has no primary contact email — the API would 400
 * anyway, and a clear hint is friendlier than a thrown error.
 */
export function DraftEmailButton({
  dealId,
  disabled,
  disabledReason,
  variant = "primary",
  size = "sm",
  label = "Draft email",
}: {
  dealId: string;
  disabled?: boolean;
  disabledReason?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  label?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Focus textarea when popover opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "initial",
          deal_id: dealId,
          personal_context: context.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to generate draft");
      }
      const json = (await res.json()) as { draft: { id: string } };
      setOpen(false);
      setContext("");
      const next = new URLSearchParams(params.toString());
      next.set("draft", json.draft.id);
      router.push(`?${next.toString()}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      generate();
    }
  }

  if (disabled) {
    return (
      <Button variant="secondary" size={size} disabled title={disabledReason}>
        {disabledReason ?? label}
      </Button>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
      >
        {busy ? "Drafting…" : label}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[360px] rounded-lg border border-warm-gray bg-white p-4 shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
            What&apos;s the angle?
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-stone">
            One or two sentences about why you&apos;re reaching out — a
            referral, something they said, an event you met at. Optional
            but it makes the draft a lot warmer.
          </p>
          <textarea
            ref={textareaRef}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onKeyDown={onKeyDown}
            rows={4}
            placeholder="e.g. Sarah at Bevan Brittan introduced us. She mentioned you're stuck with a Sage + Excel handoff."
            className="mt-2 w-full resize-y rounded-md border border-warm-gray bg-white px-3 py-2 text-[13px] leading-relaxed text-ink focus:border-forest focus:outline-none"
          />
          {error && (
            <p className="mt-2 text-[11px] text-red-700">{error}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] text-stone">⌘↵ to generate</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1 text-[12px] font-semibold text-stone hover:text-ink"
              >
                Cancel
              </button>
              <Button size="sm" onClick={generate} disabled={busy}>
                {busy ? "Drafting…" : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Opens an existing draft in the drawer. No API call — just adds the
 * `?draft=<id>` search param.
 */
export function OpenDraftButton({
  draftId,
  label = "Review & send",
}: {
  draftId: string;
  label?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function open() {
    const next = new URLSearchParams(params.toString());
    next.set("draft", draftId);
    router.push(`?${next.toString()}`);
  }

  return (
    <Button variant="primary" size="sm" onClick={open}>
      {label}
    </Button>
  );
}
