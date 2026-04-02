"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { MeetingWithLead } from "@/types";

interface CalendarGridProps {
  meetings: MeetingWithLead[];
  initialYear: number;
  initialMonth: number;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // getDay() returns 0=Sun, we want 0=Mon
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  return { daysInMonth, startDayOfWeek };
}

function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function CalendarGrid({
  meetings,
  initialYear,
  initialMonth,
}: CalendarGridProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const { daysInMonth, startDayOfWeek } = getMonthData(year, month);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  function getMeetingsForDay(day: number): MeetingWithLead[] {
    return meetings.filter((m) => {
      const d = new Date(m.scheduled_at);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() === day
      );
    });
  }

  // Build grid cells
  const cells: Array<{ day: number | null; key: string }> = [];

  // Empty cells before first day
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, key: `empty-${i}` });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: `day-${d}` });
  }

  // Fill remaining cells to complete last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: `pad-${cells.length}` });
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={prevMonth}
          className="rounded-md px-3 py-1.5 text-sm text-stone transition-colors hover:bg-warm-gray hover:text-ink"
        >
          Prev
        </button>
        <h2 className="text-sm font-semibold text-ink">
          {formatMonthYear(year, month)}
        </h2>
        <button
          onClick={nextMonth}
          className="rounded-md px-3 py-1.5 text-sm text-stone transition-colors hover:bg-warm-gray hover:text-ink"
        >
          Next
        </button>
      </div>

      {/* Calendar grid */}
      <div className="mt-3 overflow-hidden rounded-lg border border-warm-gray bg-white">
        {/* Header row */}
        <div className="grid grid-cols-7 bg-cream">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-stone"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayMeetings = cell.day ? getMeetingsForDay(cell.day) : [];
            const isToday = isCurrentMonth && cell.day === todayDate;

            return (
              <div
                key={cell.key}
                className={`min-h-[100px] border-t border-l border-warm-gray p-1.5 ${
                  isToday ? "bg-light-sage" : cell.day ? "bg-white" : "bg-cream/50"
                }`}
              >
                {cell.day && (
                  <>
                    <span
                      className={`text-[11px] font-medium ${
                        isToday ? "text-forest" : "text-stone"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayMeetings.map((meeting) => (
                        <Link
                          key={meeting.id}
                          href={`/leads/${meeting.lead_id}`}
                          className="block rounded bg-forest/10 px-1.5 py-0.5 transition-colors hover:bg-forest/20"
                        >
                          <p className="truncate text-[10px] font-medium text-forest">
                            {new Date(meeting.scheduled_at).toLocaleTimeString(
                              "en-GB",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                          <p className="truncate text-[10px] text-ink">
                            {meeting.lead.company}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status legend */}
      <div className="mt-2 flex gap-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-light-sage" />
          <span className="text-[11px] text-stone">Today</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-forest/10" />
          <span className="text-[11px] text-stone">Meeting</span>
        </span>
      </div>
    </div>
  );
}

export function UpcomingMeetings({
  meetings,
}: {
  meetings: MeetingWithLead[];
}) {
  const upcoming = meetings
    .filter(
      (m) =>
        m.status === "scheduled" && new Date(m.scheduled_at) >= new Date(),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime(),
    )
    .slice(0, 10);

  if (upcoming.length === 0) {
    return <p className="text-sm text-stone">No upcoming meetings.</p>;
  }

  return (
    <div className="space-y-2">
      {upcoming.map((meeting) => {
        const date = new Date(meeting.scheduled_at);
        return (
          <Link
            key={meeting.id}
            href={`/leads/${meeting.lead_id}`}
            className="block rounded-lg border border-warm-gray bg-white p-4 transition-colors hover:border-stone"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">
                {meeting.lead.company}
              </span>
              <Badge variant="forest">{meeting.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-stone">
              {meeting.lead.contact_name} &middot;{" "}
              {date.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}{" "}
              at{" "}
              {date.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              &middot; {meeting.duration_minutes} min
              {meeting.google_event_id && " \u00b7 Synced to Google Calendar"}
            </p>
            {meeting.notes && (
              <p className="mt-1 text-[11px] text-stone">{meeting.notes}</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
