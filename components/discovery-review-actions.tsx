"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DiscoveryReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function action(kind: "accept" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/discovery/${id}/${kind}`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      const json = await res.json().catch(() => ({}));
      if (kind === "accept" && json.company_id) {
        router.push(`/companies/${json.company_id}`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <Button
        size="sm"
        onClick={() => action("accept")}
        disabled={busy !== null}
      >
        {busy === "accept" ? "Accepting…" : "Accept"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => action("reject")}
        disabled={busy !== null}
      >
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </Button>
      {error && (
        <span className="text-[10px] text-red-700">{error}</span>
      )}
    </div>
  );
}
