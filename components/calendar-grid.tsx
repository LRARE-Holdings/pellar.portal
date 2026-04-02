"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/types";

interface CalendarGridProps {
  events: CalendarEvent[];
  initialYear: number;
  initialMonth: number;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  return { daysInMonth, startDayOfWeek };
}

function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function CalendarGrid({
  events,
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

  function getEventsForDay(day: number): CalendarEvent[] {
    return events.filter((e) => {
      const d = new Date(e.start);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() === day
      );
    });
  }

  const cells: Array<{ day: number | null; key: string }> = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, key: `empty-${i}` });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: `day-${d}` });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: `pad-${cells.length}` });
  }

  return (
    <div>
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

      <div className="mt-3 overflow-hidden rounded-lg border border-warm-gray bg-white">
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

        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayEvents = cell.day ? getEventsForDay(cell.day) : [];
            const isToday = isCurrentMonth && cell.day === todayDate;

            return (
              <div
                key={cell.key}
                className={`min-h-[100px] border-t border-l border-warm-gray p-1.5 ${
                  isToday
                    ? "bg-light-sage"
                    : cell.day
                      ? "bg-white"
                      : "bg-cream/50"
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
                      {dayEvents.map((event) => {
                        const isPortal = event.source === "portal";
                        const content = (
                          <div
                            className={`rounded px-1.5 py-0.5 transition-colors ${
                              isPortal
                                ? "bg-forest/10 hover:bg-forest/20"
                                : "bg-sage/15 hover:bg-sage/25"
                            }`}
                          >
                            {!event.isAllDay && (
                              <p
                                className={`truncate text-[10px] font-medium ${
                                  isPortal ? "text-forest" : "text-sage"
                                }`}
                              >
                                {new Date(event.start).toLocaleTimeString(
                                  "en-GB",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </p>
                            )}
                            <p className="truncate text-[10px] text-ink">
                              {event.title}
                            </p>
                          </div>
                        );

                        if (isPortal && event.leadId) {
                          return (
                            <Link
                              key={event.id}
                              href={`/leads/${event.leadId}`}
                              className="block"
                            >
                              {content}
                            </Link>
                          );
                        }

                        if (event.htmlLink) {
                          return (
                            <a
                              key={event.id}
                              href={event.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              {content}
                            </a>
                          );
                        }

                        return (
                          <div key={event.id}>{content}</div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-light-sage" />
          <span className="text-[11px] text-stone">Today</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-forest/10" />
          <span className="text-[11px] text-stone">Portal meeting</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-sage/15" />
          <span className="text-[11px] text-stone">Google Calendar</span>
        </span>
      </div>
    </div>
  );
}

export function UpcomingMeetings({
  events,
}: {
  events: CalendarEvent[];
}) {
  const upcoming = events
    .filter((e) => {
      const start = new Date(e.start);
      return start >= new Date() && (!e.status || e.status === "scheduled");
    })
    .sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    )
    .slice(0, 15);

  if (upcoming.length === 0) {
    return <p className="text-sm text-stone">No upcoming events.</p>;
  }

  return (
    <div className="space-y-2">
      {upcoming.map((event) => {
        const date = new Date(event.start);
        const isPortal = event.source === "portal";

        const card = (
          <div
            className={`rounded-lg border bg-white p-4 transition-colors hover:border-stone ${
              isPortal ? "border-forest/20" : "border-warm-gray"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">
                {event.title}
              </span>
              <Badge variant={isPortal ? "forest" : "sage"}>
                {isPortal ? "Pellar" : "Calendar"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-stone">
              {event.isAllDay
                ? date.toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }) + " (all day)"
                : `${date.toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })} at ${date.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
              {event.contactName && ` · ${event.contactName}`}
              {event.location && ` · ${event.location}`}
            </p>
          </div>
        );

        if (isPortal && event.leadId) {
          return (
            <Link key={event.id} href={`/leads/${event.leadId}`} className="block">
              {card}
            </Link>
          );
        }

        if (event.htmlLink) {
          return (
            <a
              key={event.id}
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {card}
            </a>
          );
        }

        return <div key={event.id}>{card}</div>;
      })}
    </div>
  );
}
