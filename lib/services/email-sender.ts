import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { draftInitialEmail } from "@/lib/services/email-drafter";
import type { Lead, OutreachResult, ResendEvent } from "@/types";

async function canSendToday(): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("emails")
    .select("id", { count: "exact", head: true })
    .eq("direction", "outbound")
    .gte("created_at", todayStart.toISOString());

  return (count || 0) < 50;
}

function isSendWindow(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 6 && hour < 17;
}

export async function sendOutreachEmail(
  leadId: string,
  customSubject?: string | null,
  customBody?: string | null,
): Promise<OutreachResult> {
  // 1. Fetch lead
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const typedLead = lead as Lead;

  // 2. Check contact email
  if (!typedLead.contact_email) {
    throw new Error(`No contact email for lead: ${typedLead.company}`);
  }

  // 3. Check send guards
  if (!isSendWindow()) {
    throw new Error(
      "Outside send window (06:00-17:00 UTC, Monday-Friday only)",
    );
  }

  if (!(await canSendToday())) {
    throw new Error("Daily send limit reached (50 emails/day)");
  }

  // 4. Draft or use custom content
  let subject: string;
  let bodyHtml: string;
  let bodyText: string;

  if (customSubject && customBody) {
    subject = customSubject;
    bodyHtml = `<p>${customBody.replace(/\n/g, "</p><p>")}</p>`;
    bodyText = customBody;
  } else {
    const draft = await draftInitialEmail(typedLead);
    subject = draft.subject;
    bodyHtml = draft.body_html;
    bodyText = draft.body_text;
  }

  // 5. Insert email record with status queued
  const { data: emailRecord, error: insertError } = await supabaseAdmin
    .from("emails")
    .insert({
      lead_id: typedLead.id,
      direction: "outbound",
      status: "queued",
      from_address: "alex@pellar.co.uk",
      to_address: typedLead.contact_email,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
    })
    .select()
    .single();

  if (insertError || !emailRecord) {
    throw new Error("Failed to create email record");
  }

  // 6. Send via Resend
  try {
    const result = await resend.emails.send({
      from: "Alex at Pellar <alex@pellar.co.uk>",
      to: typedLead.contact_email,
      subject,
      html: bodyHtml,
      text: bodyText,
      replyTo: "alex@inbound.pellar.co.uk",
      tags: [
        { name: "lead_id", value: typedLead.id },
        { name: "offering", value: typedLead.offering || "software" },
      ],
    });

    // 7. Update email status to sent
    await supabaseAdmin
      .from("emails")
      .update({ status: "sent", resend_id: result.data?.id || null })
      .eq("id", emailRecord.id);

    // 8. Update lead stage to contacted if currently identified
    if (typedLead.stage === "identified") {
      await supabaseAdmin
        .from("leads")
        .update({ stage: "contacted" })
        .eq("id", typedLead.id);
    }

    // 9. Log activity
    await supabaseAdmin.from("activity_log").insert({
      lead_id: typedLead.id,
      type: "email_sent",
      description: `Sent outreach to ${typedLead.contact_name} at ${typedLead.company}: "${subject}"`,
    });

    return {
      email_id: emailRecord.id,
      resend_id: result.data?.id || null,
      subject,
      status: "sent",
    };
  } catch (sendError) {
    // Update email status to failed
    await supabaseAdmin
      .from("emails")
      .update({ status: "failed" })
      .eq("id", emailRecord.id);

    throw new Error(
      `Failed to send email: ${sendError instanceof Error ? sendError.message : "Unknown error"}`,
    );
  }
}

export async function handleDeliveryEvent(payload: ResendEvent) {
  const resendId = payload.data?.email_id;
  if (!resendId) return;

  const statusMap: Record<string, string> = {
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.bounced": "bounced",
  };

  const newStatus = statusMap[payload.type];
  if (!newStatus) return;

  await supabaseAdmin
    .from("emails")
    .update({ status: newStatus })
    .eq("resend_id", resendId);
}
