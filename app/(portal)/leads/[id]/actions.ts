"use server";

import { sendOutreachEmail } from "@/lib/services/email-sender";
import { generateBriefing } from "@/lib/services/briefing-gen";
import {
  scheduleMeeting,
  cancelMeeting,
} from "@/lib/services/meetings";
import * as hunter from "@/lib/clients/hunter";

export async function triggerOutreach(leadId: string) {
  return sendOutreachEmail(leadId);
}

export async function triggerBriefing(leadId: string) {
  return generateBriefing(leadId);
}

export async function scheduleMeetingAction(
  leadId: string,
  scheduledAt: string,
  durationMinutes: number,
  notes: string,
) {
  return scheduleMeeting({
    leadId,
    title: "Scoping call",
    scheduledAt,
    durationMinutes,
    notes: notes || undefined,
  });
}

export async function cancelMeetingAction(meetingId: string) {
  return cancelMeeting(meetingId);
}

export async function findLeadEmail(
  leadId: string,
): Promise<{ email: string; score: number } | null> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, company, contact_name, website, contact_email")
    .eq("id", leadId)
    .single();

  if (!lead) throw new Error("Lead not found");
  if (lead.contact_email) return { email: lead.contact_email, score: 100 };

  if (!lead.website || !lead.contact_name || lead.contact_name === "Unknown") {
    throw new Error(
      "Cannot look up email: lead needs both a website and a contact name",
    );
  }

  const domain = (() => {
    try {
      const url = new URL(
        lead.website.startsWith("http") ? lead.website : `https://${lead.website}`,
      );
      return url.hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  if (!domain) throw new Error("Could not parse domain from website");

  const nameParts = lead.contact_name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  if (!firstName || !lastName) {
    throw new Error("Contact name must include a first and last name");
  }

  const result = await hunter.findEmail({ domain, firstName, lastName });

  if (!result || result.score < 50) {
    throw new Error(
      `Could not find a reliable email for ${lead.contact_name} at ${domain}`,
    );
  }

  await supabaseAdmin
    .from("leads")
    .update({ contact_email: result.email })
    .eq("id", leadId);

  await supabaseAdmin.from("activity_log").insert({
    lead_id: leadId,
    type: "email_found",
    description: `Found email ${result.email} via Hunter.io (confidence: ${result.score}%)`,
  });

  return { email: result.email, score: result.score };
}

export async function updateDealValue(leadId: string, value: number | null) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  await supabaseAdmin
    .from("leads")
    .update({ deal_value: value })
    .eq("id", leadId);
}
