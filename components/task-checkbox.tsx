"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TaskCheckboxProps {
  taskId: string;
  completed: boolean;
  label: string;
}

export function TaskCheckbox({ taskId, completed, label }: TaskCheckboxProps) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(completed);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    setLoading(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
      if (!res.ok) {
        setOptimistic(!next);
      } else {
        router.refresh();
      }
    } catch {
      setOptimistic(!next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-warm-gray transition-colors hover:border-forest disabled:opacity-50"
      aria-label={`Mark ${label} ${optimistic ? "incomplete" : "complete"}`}
    >
      {optimistic && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-forest"
        >
          <polyline points="1.5 5 4 7.5 8.5 2.5" />
        </svg>
      )}
    </button>
  );
}
