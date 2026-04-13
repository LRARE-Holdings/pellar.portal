import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  listEvents,
  createEvent,
  getSystemUserId,
} from "@/lib/clients/google-calendar";
import { upsertCompany } from "@/lib/services/companies";
import { upsertContact } from "@/lib/services/contacts";
import { createDeal } from "@/lib/services/deals";
import { getOfferingBySlug } from "@/lib/services/offerings";
import { logTimelineEvent } from "@/lib/services/timeline";
import type {
  AvailableSlot,
  Booking,
  BookingAvailability,
  BookingMeetingType,
  BookingOverride,
} from "@/types";

const SLOT_DURATION_MINUTES = 30;
const MAX_LOOKAHEAD_DAYS = 30;
const MAX_BOOKINGS_PER_IP_PER_DAY = 3;

// ============================================================================
// Availability computation
// ============================================================================

interface TimeWindow {
  start: number; // minutes from midnight
  end: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToISO(date: string, minutes: number, tz: string): string {
  // Build a date in Europe/London timezone
  const d = new Date(`${date}T00:00:00`);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  // Use Intl to figure out the UTC offset for this date in Europe/London
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(d);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  const offsetStr = offsetPart?.value ?? "+00";

  // Parse offset like "GMT+1" or "GMT"
  let offsetMinutes = 0;
  const match = offsetStr.match(/GMT([+-]\d+)?/);
  if (match?.[1]) {
    offsetMinutes = parseInt(match[1]) * 60;
  }

  // Create UTC time by subtracting the offset
  const utcMs =
    d.getTime() + (hours * 60 + mins - offsetMinutes) * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function generateSlots(
  windows: TimeWindow[],
  busyPeriods: TimeWindow[],
  durationMinutes: number,
): TimeWindow[] {
  const slots: TimeWindow[] = [];

  for (const window of windows) {
    let cursor = window.start;
    while (cursor + durationMinutes <= window.end) {
      const slotEnd = cursor + durationMinutes;
      const isBusy = busyPeriods.some(
        (busy) => cursor < busy.end && slotEnd > busy.start,
      );
      if (!isBusy) {
        slots.push({ start: cursor, end: slotEnd });
      }
      cursor += durationMinutes;
    }
  }

  return slots;
}

export async function getAvailableSlots(
  date: string,
): Promise<AvailableSlot[]> {
  const sb = getSupabaseAdmin();
  const targetDate = new Date(`${date}T12:00:00Z`);
  const dayOfWeek = targetDate.getUTCDay(); // 0=Sun ... 6=Sat

  // Validate date range
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_LOOKAHEAD_DAYS);

  if (targetDate < tomorrow || targetDate > maxDate) {
    return [];
  }

  // 1. Get recurring availability for this day of week
  const { data: availability } = await sb
    .from("booking_availability")
    .select("*")
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);

  const windows: TimeWindow[] = (
    (availability ?? []) as BookingAvailability[]
  ).map((a) => ({
    start: timeToMinutes(a.start_time),
    end: timeToMinutes(a.end_time),
  }));

  if (windows.length === 0) return [];

  // 2. Apply overrides for this specific date
  const { data: overrides } = await sb
    .from("booking_overrides")
    .select("*")
    .eq("override_date", date);

  const typedOverrides = (overrides ?? []) as BookingOverride[];

  // Check for whole-day blocks
  const wholeDayBlock = typedOverrides.find(
    (o) =>
      o.override_type === "blocked" && !o.start_time && !o.end_time,
  );
  if (wholeDayBlock) return [];

  // Remove blocked time ranges
  const blockedRanges: TimeWindow[] = typedOverrides
    .filter((o) => o.override_type === "blocked" && o.start_time && o.end_time)
    .map((o) => ({
      start: timeToMinutes(o.start_time!),
      end: timeToMinutes(o.end_time!),
    }));

  // Add extra availability windows
  const extraWindows: TimeWindow[] = typedOverrides
    .filter(
      (o) => o.override_type === "available" && o.start_time && o.end_time,
    )
    .map((o) => ({
      start: timeToMinutes(o.start_time!),
      end: timeToMinutes(o.end_time!),
    }));

  const allWindows = [...windows, ...extraWindows];

  // 3. Get Google Calendar busy times for this date
  const busyPeriods: TimeWindow[] = [...blockedRanges];

  const systemUserId = await getSystemUserId();
  if (systemUserId) {
    const tz = "Europe/London";
    const dayStart = minutesToISO(date, 0, tz);
    const dayEnd = minutesToISO(date, 24 * 60, tz);

    const googleEvents = await listEvents(systemUserId, dayStart, dayEnd);
    for (const evt of googleEvents) {
      if (evt.isAllDay) {
        // All-day events block the entire day
        busyPeriods.push({ start: 0, end: 24 * 60 });
        continue;
      }
      const evtStart = new Date(evt.start);
      const evtEnd = new Date(evt.end);

      // Convert to minutes-from-midnight in Europe/London
      const startLocal = new Date(
        evtStart.toLocaleString("en-US", { timeZone: tz }),
      );
      const endLocal = new Date(
        evtEnd.toLocaleString("en-US", { timeZone: tz }),
      );
      busyPeriods.push({
        start: startLocal.getHours() * 60 + startLocal.getMinutes(),
        end: endLocal.getHours() * 60 + endLocal.getMinutes(),
      });
    }
  }

  // 4. Get existing confirmed bookings for this date
  const tz = "Europe/London";
  const dateStart = minutesToISO(date, 0, tz);
  const dateEnd = minutesToISO(date, 24 * 60, tz);

  const { data: existingBookings } = await sb
    .from("bookings")
    .select("slot_start, slot_end")
    .eq("status", "confirmed")
    .gte("slot_start", dateStart)
    .lt("slot_start", dateEnd);

  for (const booking of existingBookings ?? []) {
    const bStart = new Date(booking.slot_start);
    const bEnd = new Date(booking.slot_end);
    const startLocal = new Date(
      bStart.toLocaleString("en-US", { timeZone: tz }),
    );
    const endLocal = new Date(
      bEnd.toLocaleString("en-US", { timeZone: tz }),
    );
    busyPeriods.push({
      start: startLocal.getHours() * 60 + startLocal.getMinutes(),
      end: endLocal.getHours() * 60 + endLocal.getMinutes(),
    });
  }

  // 5. Generate available slots
  const rawSlots = generateSlots(allWindows, busyPeriods, SLOT_DURATION_MINUTES);

  return rawSlots.map((s) => ({
    start: minutesToISO(date, s.start, tz),
    end: minutesToISO(date, s.end, tz),
  }));
}

// ============================================================================
// Reservation
// ============================================================================

export interface ReserveSlotInput {
  name: string;
  email: string;
  company?: string;
  message?: string;
  service_interest?: string;
  meeting_type: BookingMeetingType;
  slot_start: string;
  ip_address?: string;
}

export interface ReserveSlotResult {
  booking: Booking;
  deal_id: string;
  company_id: string;
  contact_id: string;
}

export async function reserveSlot(
  input: ReserveSlotInput,
): Promise<ReserveSlotResult> {
  const sb = getSupabaseAdmin();

  // Rate limit by IP
  if (input.ip_address) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", input.ip_address)
      .gte("created_at", dayAgo);
    if ((count ?? 0) >= MAX_BOOKINGS_PER_IP_PER_DAY) {
      throw new Error("Too many bookings from this address. Try again tomorrow.");
    }
  }

  // Verify slot is still available (the unique index prevents races at DB level too)
  const slotStart = new Date(input.slot_start);
  const slotEnd = new Date(
    slotStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000,
  );

  const { count: existing } = await sb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_start", slotStart.toISOString())
    .eq("status", "confirmed");

  if ((existing ?? 0) > 0) {
    throw new Error("This time slot is no longer available.");
  }

  // CRM upserts (same pattern as /api/contact)
  const emailDomain = input.email.split("@")[1] ?? null;
  const companyName =
    input.company ||
    (emailDomain ? domainToName(emailDomain) : `${input.name} (booking)`);

  const { company: companyRow } = await upsertCompany(
    {
      name: companyName,
      domain: emailDomain,
      website: emailDomain ? `https://${emailDomain}` : null,
      source: "booking",
      source_detail: {
        service_interest: input.service_interest ?? null,
        meeting_type: input.meeting_type,
        message: input.message ?? null,
      },
      notes: input.message ?? null,
    },
    null,
  );

  const { contact: contactRow } = await upsertContact(
    {
      company_id: companyRow.id,
      name: input.name,
      email: input.email,
      is_primary: true,
      source: "booking",
      source_detail: {
        service_interest: input.service_interest ?? null,
        meeting_type: input.meeting_type,
      },
    },
    null,
  );

  const offeringSlug = interestToOffering(input.service_interest ?? "");
  const offering = offeringSlug ? await getOfferingBySlug(offeringSlug) : null;

  const dealTitle = input.company
    ? `${input.company} — Scoping call`
    : `${input.name} — Scoping call`;

  const deal = await createDeal(
    {
      company_id: companyRow.id,
      primary_contact_id: contactRow.id,
      offering_id: offering?.id ?? null,
      title: dealTitle,
      stage: "lead",
      source: "booking",
      source_detail: {
        service_interest: input.service_interest ?? null,
        meeting_type: input.meeting_type,
        message: input.message ?? null,
        booked_slot: slotStart.toISOString(),
      },
      notes: input.message ?? null,
    },
    null,
  );

  // Google Calendar event
  const systemUserId = await getSystemUserId();
  let googleEventId: string | null = null;
  let meetLink: string | null = null;

  if (systemUserId) {
    const isVirtual = input.meeting_type === "google_meet";
    const locationText = isVirtual
      ? "Google Meet (link in invite)"
      : "The Stamp Exchange, Westgate Road, Newcastle upon Tyne, NE1 1SA";

    const calResult = await createEvent(systemUserId, {
      summary: `Pellar — ${companyName}`,
      description: [
        `Scoping call with ${input.name} from ${companyName}`,
        input.service_interest
          ? `Interest: ${input.service_interest}`
          : null,
        input.message ? `\nMessage: ${input.message}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: slotStart.toISOString(),
      durationMinutes: SLOT_DURATION_MINUTES,
      attendeeEmail: input.email,
      location: locationText,
      addMeetLink: isVirtual,
    });

    if (calResult) {
      googleEventId = calResult.eventId;
      meetLink = calResult.meetLink;
    }
  }

  // Insert meeting
  const { data: meetingRow } = await sb
    .from("meetings")
    .insert({
      deal_id: deal.id,
      company_id: companyRow.id,
      contact_id: contactRow.id,
      title: `Scoping call — ${companyName}`,
      scheduled_at: slotStart.toISOString(),
      duration_minutes: SLOT_DURATION_MINUTES,
      location:
        input.meeting_type === "google_meet"
          ? meetLink ?? "Google Meet"
          : "The Stamp Exchange, NE1 1SA",
      status: "scheduled",
      source: "portal",
      google_event_id: googleEventId,
    })
    .select()
    .single();

  // Insert booking
  const { data: bookingRow, error: bookingError } = await sb
    .from("bookings")
    .insert({
      meeting_id: meetingRow?.id ?? null,
      company_id: companyRow.id,
      contact_id: contactRow.id,
      deal_id: deal.id,
      visitor_name: input.name,
      visitor_email: input.email,
      visitor_company: input.company ?? null,
      visitor_message: input.message ?? null,
      service_interest: input.service_interest ?? null,
      meeting_type: input.meeting_type,
      slot_start: slotStart.toISOString(),
      slot_end: slotEnd.toISOString(),
      duration_minutes: SLOT_DURATION_MINUTES,
      status: "confirmed",
      google_event_id: googleEventId,
      google_meet_link: meetLink,
      enrichment_status: "pending",
      ip_address: input.ip_address ?? null,
    })
    .select()
    .single();

  if (bookingError || !bookingRow) {
    throw new Error(
      bookingError?.message?.includes("idx_bookings_no_double")
        ? "This time slot is no longer available."
        : `Failed to create booking: ${bookingError?.message}`,
    );
  }

  // Timeline event
  await logTimelineEvent({
    type: "booking_created",
    company_id: companyRow.id,
    contact_id: contactRow.id,
    deal_id: deal.id,
    description: `Booking: ${input.name} from ${companyName} — ${input.meeting_type === "google_meet" ? "Google Meet" : "in person"}`,
    metadata: {
      booking_id: bookingRow.id,
      slot_start: slotStart.toISOString(),
      service_interest: input.service_interest ?? null,
    },
  });

  return {
    booking: bookingRow as Booking,
    deal_id: deal.id,
    company_id: companyRow.id,
    contact_id: contactRow.id,
  };
}

// ============================================================================
// Admin availability management
// ============================================================================

export async function listAvailability(): Promise<BookingAvailability[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("booking_availability")
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(`Failed to list availability: ${error.message}`);
  return (data ?? []) as BookingAvailability[];
}

export async function upsertAvailability(input: {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}): Promise<BookingAvailability> {
  const sb = getSupabaseAdmin();

  if (input.id) {
    const { data, error } = await sb
      .from("booking_availability")
      .update({
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
        is_active: input.is_active,
      })
      .eq("id", input.id)
      .select()
      .single();
    if (error || !data) {
      throw new Error(`Failed to update availability: ${error?.message}`);
    }
    return data as BookingAvailability;
  }

  const { data, error } = await sb
    .from("booking_availability")
    .insert({
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      is_active: input.is_active,
    })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to create availability: ${error?.message}`);
  }
  return data as BookingAvailability;
}

export async function deleteAvailability(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("booking_availability")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete availability: ${error.message}`);
}

export async function listOverrides(
  from?: string,
  to?: string,
): Promise<BookingOverride[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("booking_overrides")
    .select("*")
    .order("override_date", { ascending: true });

  if (from) q = q.gte("override_date", from);
  if (to) q = q.lte("override_date", to);

  const { data, error } = await q;
  if (error) throw new Error(`Failed to list overrides: ${error.message}`);
  return (data ?? []) as BookingOverride[];
}

export async function createOverride(input: {
  override_date: string;
  override_type: "available" | "blocked";
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}): Promise<BookingOverride> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("booking_overrides")
    .insert({
      override_date: input.override_date,
      override_type: input.override_type,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      reason: input.reason ?? null,
    })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to create override: ${error?.message}`);
  }
  return data as BookingOverride;
}

export async function deleteOverride(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("booking_overrides")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete override: ${error.message}`);
}

// ============================================================================
// Helpers
// ============================================================================

function interestToOffering(interest: string): string | null {
  const map: Record<string, string> = {
    web_app: "software",
    mvp: "software",
    website: "software",
    retainer: "software",
    pipeline: "automation",
    referral: "automation",
    ai_notes: "ai",
    ai_crm: "ai",
    custom_ai: "ai",
  };
  return map[interest] ?? null;
}

function domainToName(domain: string): string {
  const root = domain.split(".")[0];
  return root.charAt(0).toUpperCase() + root.slice(1);
}
