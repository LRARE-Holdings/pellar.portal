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
): Promise<{ email: string; score: number } | { error: string }> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, company, contact_name, website, contact_email")
    .eq("id", leadId)
    .single();

  if (!lead) return { error: "Lead not found" };
  if (lead.contact_email) return { email: lead.contact_email, score: 100 };

  if (!lead.website) {
    return { error: "No website on file — cannot look up email without a domain" };
  }

  if (!lead.contact_name || lead.contact_name === "Unknown") {
    return { error: "No contact name on file — cannot look up email without a name" };
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

  if (!domain) return { error: "Could not parse domain from website URL" };

  const nameParts = lead.contact_name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  if (!firstName || !lastName) {
    return { error: "Contact name must include a first and last name" };
  }

  try {
    const result = await hunter.findEmail({ domain, firstName, lastName });

    if (!result || result.score < 50) {
      return {
        error: `Could not find a reliable email for ${lead.contact_name} at ${domain}`,
      };
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
  } catch {
    return { error: "Hunter.io lookup failed — check that HUNTER_API_KEY is set" };
  }
}

export async function updateDealValue(leadId: string, value: number | null) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  await supabaseAdmin
    .from("leads")
    .update({ deal_value: value })
    .eq("id", leadId);
}
