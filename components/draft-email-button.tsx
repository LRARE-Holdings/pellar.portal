"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Generates an AI draft for a deal, then opens the draft drawer by adding
 * `?draft=<id>` to the current URL. The drawer is mounted globally in the
 * portal layout and reacts to that search param.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "initial", deal_id: dealId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to generate draft");
      }
      const json = (await res.json()) as { draft: { id: string } };
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

  if (disabled) {
    return (
      <Button variant="secondary" size={size} disabled title={disabledReason}>
        {disabledReason ?? label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={generate}
        disabled={busy}
      >
        {busy ? "Drafting…" : label}
      </Button>
      {error && (
        <span className="text-[10px] text-red-700">{error}</span>
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
