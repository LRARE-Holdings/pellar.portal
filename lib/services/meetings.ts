import { supabaseAdmin } from "@/lib/supabase/admin";
import * as googleCalendar from "@/lib/clients/google-calendar";
import type { Lead, Meeting } from "@/types";
import { OFFERING_DESCRIPTIONS } from "@/types";
import type { OfferingType } from "@/types";

export async function scheduleMeeting(params: {
  leadId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  location?: string;
  notes?: string;
  userId?: string;
}): Promise<Meeting> {
  // Fetch lead for context
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", params.leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(`Lead not found: ${params.leadId}`);
  }

  const typedLead = lead as Lead;

  // Create meeting record
  const { data: meeting, error: insertError } = await supabaseAdmin
    .from("meetings")
    .insert({
      lead_id: params.leadId,
      title: params.title,
      scheduled_at: params.scheduledAt,
      duration_minutes: params.durationMinutes,
      location: params.location || null,
      notes: params.notes || null,
      status: "scheduled",
    })
    .select()
    .single();

  if (insertError || !meeting) {
    throw new Error("Failed to create meeting record");
  }

  // Sync to Google Calendar if user has OAuth tokens
  if (params.userId) {
    try {
      const eventId = await googleCalendar.createEvent(params.userId, {
        summary: `${typedLead.company}: ${params.title}`,
        description: buildEventDescription(typedLead),
        start: params.scheduledAt,
        durationMinutes: params.durationMinutes,
        attendeeEmail: typedLead.contact_email || undefined,
        location: params.location,
      });

      if (eventId) {
        await supabaseAdmin
          .from("meetings")
          .update({ google_event_id: eventId })
          .eq("id", meeting.id);
        meeting.google_event_id = eventId;
      }
    } catch {
      // Calendar sync failed, meeting still created in portal
    }
  }

  // Update lead stage to scoping_call if currently responded
  if (typedLead.stage === "responded") {
    await supabaseAdmin
      .from("leads")
      .update({ stage: "scoping_call" })
      .eq("id", typedLead.id);
  }

  // Log activity
  const scheduledDate = new Date(params.scheduledAt);
  await supabaseAdmin.from("activity_log").insert({
    lead_id: params.leadId,
    type: "meeting_scheduled",
    description: `Meeting scheduled with ${typedLead.contact_name} at ${typedLead.company} for ${scheduledDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${scheduledDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
    metadata: { meeting_id: meeting.id },
  });

  return meeting as Meeting;
}

export async function cancelMeeting(
  meetingId: string,
  userId?: string,
): Promise<void> {
  const { data: meeting } = await supabaseAdmin
    .from("meetings")
    .select("*, leads(company, contact_name)")
    .eq("id", meetingId)
    .single();

  if (!meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  // Delete from Google Calendar if synced
  if (meeting.google_event_id && userId) {
    await googleCalendar.deleteEvent(userId, meeting.google_event_id);
  }

  // Update status
  await supabaseAdmin
    .from("meetings")
    .update({ status: "cancelled" })
    .eq("id", meetingId);

  // Log activity
  const leadData = meeting.leads as { company: string; contact_name: string } | null;
  await supabaseAdmin.from("activity_log").insert({
    lead_id: meeting.lead_id,
    type: "meeting_cancelled",
    description: `Meeting with ${leadData?.contact_name || "Unknown"} at ${leadData?.company || "Unknown"} cancelled`,
    metadata: { meeting_id: meetingId },
  });
}

export async function completeMeeting(meetingId: string): Promise<void> {
  await supabaseAdmin
    .from("meetings")
    .update({ status: "completed" })
    .eq("id", meetingId);
}

export async function autoScheduleMeetingFromIntent(
  leadId: string,
  meetingPreference: string | null,
  userId?: string,
): Promise<Meeting | null> {
  try {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("company, contact_name")
      .eq("id", leadId)
      .single();

    if (!lead) return null;

    // Parse meeting preference or default to next weekday at 14:00 UTC
    const scheduledAt = parseMeetingPreference(meetingPreference);

    return await scheduleMeeting({
      leadId,
      title: "Scoping call",
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: 30,
      notes: meetingPreference
        ? `Lead preference: ${meetingPreference}`
        : "Auto-scheduled from meeting intent. Confirm time with lead.",
      userId,
    });
  } catch {
    return null;
  }
}

function parseMeetingPreference(preference: string | null): Date {
  // Default: next weekday at 14:00 UTC (2pm or 3pm UK depending on BST)
  const now = new Date();
  const next = new Date(now);

  // Move to next day
  next.setDate(next.getDate() + 1);

  // Skip weekends
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  next.setUTCHours(14, 0, 0, 0);

  if (!preference) return next;

  const lower = preference.toLowerCase();

  // Try to match day names
  const dayMap: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
  };

  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (lower.includes(dayName)) {
      const target = new Date(now);
      const currentDay = target.getUTCDay();
      let daysAhead = dayNum - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      target.setDate(target.getDate() + daysAhead);
      target.setUTCHours(14, 0, 0, 0);

      // Check for afternoon preference
      if (lower.includes("afternoon")) {
        target.setUTCHours(14, 0, 0, 0);
      } else if (lower.includes("morning")) {
        target.setUTCHours(9, 0, 0, 0);
      }

      return target;
    }
  }

  return next;
}

function buildEventDescription(lead: Lead): string {
  const parts: string[] = [];
  parts.push(`Contact: ${lead.contact_name}`);
  if (lead.contact_email) parts.push(`Email: ${lead.contact_email}`);
  parts.push(`Industry: ${lead.industry}`);
  parts.push(`Location: ${lead.location}`);
  if (lead.frustration) parts.push(`\nContext: ${lead.frustration}`);
  if (lead.offering) {
    parts.push(
      `\nRecommended offering: ${OFFERING_DESCRIPTIONS[lead.offering as OfferingType] || lead.offering}`,
    );
  }
  return parts.join("\n");
}
