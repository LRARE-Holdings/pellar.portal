"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingStatus } from "@/types";

interface BookingActionsProps {
  bookingId: string;
  currentStatus: BookingStatus;
}

const transitions: Record<BookingStatus, { label: string; to: BookingStatus }[]> = {
  confirmed: [
    { label: "Mark completed", to: "completed" },
    { label: "Mark no-show", to: "no_show" },
    { label: "Cancel", to: "cancelled" },
  ],
  completed: [],
  no_show: [],
  cancelled: [{ label: "Reinstate", to: "confirmed" }],
};

export function BookingActions({ bookingId, currentStatus }: BookingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ label: string; to: BookingStatus } | null>(null);

  const actions = transitions[currentStatus] ?? [];
  if (actions.length === 0) return null;

  async function handleUpdate(status: BookingStatus) {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  if (confirmAction) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-stone">
          {confirmAction.label}?
        </span>
        <button
          onClick={() => handleUpdate(confirmAction.to)}
          disabled={loading}
          className="rounded-md bg-forest px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-forest/90 disabled:opacity-50"
        >
          {loading ? "..." : "Confirm"}
        </button>
        <button
          onClick={() => setConfirmAction(null)}
          disabled={loading}
          className="rounded-md border border-warm-gray px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone transition-colors hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {actions.map((action) => (
        <button
          key={action.to}
          onClick={() =>
            action.to === "cancelled" || action.to === "no_show"
              ? setConfirmAction(action)
              : handleUpdate(action.to)
          }
          disabled={loading}
          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${
            action.to === "completed"
              ? "bg-forest/10 text-forest hover:bg-forest/20"
              : action.to === "cancelled"
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "border border-warm-gray text-stone hover:text-ink"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
