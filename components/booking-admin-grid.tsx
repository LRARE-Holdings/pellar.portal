"use client";

import { useState } from "react";
import type { BookingAvailability, BookingOverride } from "@/types";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface Props {
  initialAvailability: BookingAvailability[];
  initialOverrides: BookingOverride[];
}

export function BookingAdminGrid({
  initialAvailability,
  initialOverrides,
}: Props) {
  const [availability, setAvailability] =
    useState<BookingAvailability[]>(initialAvailability);
  const [overrides, setOverrides] =
    useState<BookingOverride[]>(initialOverrides);
  const [saving, setSaving] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideType, setOverrideType] = useState<"blocked" | "available">(
    "blocked",
  );
  const [overrideReason, setOverrideReason] = useState("");

  async function handleToggle(item: BookingAvailability) {
    setSaving(true);
    try {
      const res = await fetch("/api/booking/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          day_of_week: item.day_of_week,
          start_time: item.start_time,
          end_time: item.end_time,
          is_active: !item.is_active,
        }),
      });
      if (res.ok) {
        const { availability: updated } = await res.json();
        setAvailability((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a)),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTimeChange(
    item: BookingAvailability,
    field: "start_time" | "end_time",
    value: string,
  ) {
    setSaving(true);
    try {
      const res = await fetch("/api/booking/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          day_of_week: item.day_of_week,
          start_time: field === "start_time" ? value : item.start_time,
          end_time: field === "end_time" ? value : item.end_time,
          is_active: item.is_active,
        }),
      });
      if (res.ok) {
        const { availability: updated } = await res.json();
        setAvailability((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a)),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddOverride() {
    if (!overrideDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/booking/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          override_date: overrideDate,
          override_type: overrideType,
          reason: overrideReason || null,
        }),
      });
      if (res.ok) {
        const { override } = await res.json();
        setOverrides((prev) => [...prev, override]);
        setOverrideDate("");
        setOverrideReason("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOverride(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/booking/overrides/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== id));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Weekly schedule */}
      <div className="rounded-lg border border-warm-gray bg-white p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Weekly Schedule
        </h2>
        <p className="mt-1 text-[11px] text-stone">
          Set recurring availability for each day of the week.
        </p>

        <div className="mt-4 space-y-2">
          {DAY_LABELS.map((label, dayIndex) => {
            const slot = availability.find((a) => a.day_of_week === dayIndex);
            if (!slot) {
              return (
                <div
                  key={dayIndex}
                  className="flex items-center gap-4 py-2 text-sm text-stone"
                >
                  <span className="w-24 text-sm font-medium text-ink">
                    {label}
                  </span>
                  <span className="text-[11px]">Not configured</span>
                </div>
              );
            }

            return (
              <div
                key={slot.id}
                className="flex flex-wrap items-center gap-4 rounded-md border border-warm-gray px-4 py-3"
              >
                <span className="w-24 text-sm font-medium text-ink">
                  {label}
                </span>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={slot.is_active}
                    onChange={() => handleToggle(slot)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-warm-gray text-forest accent-forest"
                  />
                  <span className="text-[11px] text-stone">Active</span>
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start_time.slice(0, 5)}
                    onChange={(e) =>
                      handleTimeChange(slot, "start_time", e.target.value)
                    }
                    disabled={saving || !slot.is_active}
                    className="rounded border border-warm-gray bg-cream px-2 py-1 text-sm text-ink disabled:opacity-50"
                  />
                  <span className="text-[11px] text-stone">to</span>
                  <input
                    type="time"
                    value={slot.end_time.slice(0, 5)}
                    onChange={(e) =>
                      handleTimeChange(slot, "end_time", e.target.value)
                    }
                    disabled={saving || !slot.is_active}
                    className="rounded border border-warm-gray bg-cream px-2 py-1 text-sm text-ink disabled:opacity-50"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Date overrides */}
      <div className="rounded-lg border border-warm-gray bg-white p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Date Overrides
        </h2>
        <p className="mt-1 text-[11px] text-stone">
          Block specific dates or add extra availability.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
              Date
            </label>
            <input
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              className="mt-1 rounded border border-warm-gray bg-cream px-3 py-1.5 text-sm text-ink"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
              Type
            </label>
            <select
              value={overrideType}
              onChange={(e) =>
                setOverrideType(e.target.value as "blocked" | "available")
              }
              className="mt-1 rounded border border-warm-gray bg-cream px-3 py-1.5 text-sm text-ink"
            >
              <option value="blocked">Block day</option>
              <option value="available">Extra availability</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
              Reason
            </label>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Optional"
              className="mt-1 rounded border border-warm-gray bg-cream px-3 py-1.5 text-sm text-ink placeholder:text-stone"
            />
          </div>

          <button
            onClick={handleAddOverride}
            disabled={saving || !overrideDate}
            className="rounded-md bg-forest px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-forest/90 disabled:opacity-50"
          >
            Add override
          </button>
        </div>

        {overrides.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {overrides.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-md border border-warm-gray px-4 py-2"
              >
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.03em] ${
                    o.override_type === "blocked"
                      ? "bg-red-50 text-red-700"
                      : "bg-light-sage text-forest"
                  }`}
                >
                  {o.override_type}
                </span>
                <span className="text-sm text-ink">
                  {new Date(o.override_date + "T12:00:00").toLocaleDateString(
                    "en-GB",
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                </span>
                {o.start_time && o.end_time && (
                  <span className="text-[11px] text-stone">
                    {o.start_time.slice(0, 5)} – {o.end_time.slice(0, 5)}
                  </span>
                )}
                {o.reason && (
                  <span className="text-[11px] text-stone">{o.reason}</span>
                )}
                <button
                  onClick={() => handleDeleteOverride(o.id)}
                  disabled={saving}
                  className="ml-auto text-[11px] text-stone transition-colors hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
