import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { draftInitialEmail } from "@/lib/services/email-drafter";
import type { Lead } from "@/types";

const DAILY_LIMIT = 50;
const MIN_SCORE = 60;

interface AutoOutreachResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

async function getSentTodayCount(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("emails")
    .select("id", { count: "exact", head: true })
    .eq("direction", "outbound")
    .gte("created_at", todayStart.toISOString());

  return count || 0;
}

export async function runAutoOutreach(): Promise<AutoOutreachResult> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  // 1. Check remaining daily budget
  const sentToday = await getSentTodayCount();
  const remaining = DAILY_LIMIT - sentToday;

  if (remaining <= 0) {
    return { sent: 0, failed: 0, skipped: 0, errors: ["Daily limit already reached"] };
  }

  // 2. Find eligible leads: identified, score >= 60, has email, not stale
  const { data: leads, error: queryError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("stage", "identified")
    .gte("score", MIN_SCORE)
    .not("contact_email", "is", null)
    .eq("stale", false)
    .order("score", { ascending: false })
    .limit(remaining);

  if (queryError || !leads) {
    return { sent: 0, failed: 0, skipped: 0, errors: [queryError?.message || "Failed to query leads"] };
  }

  const skipped = 0;

  // 3. Send outreach to each eligible lead
  for (const row of leads) {
    const lead = row as Lead;

    try {
      // Draft personalised email via Claude
      const draft = await draftInitialEmail(lead);

      // Insert email record
      const { data: emailRecord, error: insertError } = await supabaseAdmin
        .from("emails")
        .insert({
          lead_id: lead.id,
          direction: "outbound",
          status: "queued",
          from_address: "alex@pellar.co.uk",
          to_address: lead.contact_email,
          subject: draft.subject,
          body_html: draft.body_html,
          body_text: draft.body_text,
        })
        .select()
        .single();

      if (insertError || !emailRecord) {
        errors.push(`Failed to create email record for ${lead.company}: ${insertError?.message || "Unknown"}`);
        failed++;
        continue;
      }

      // Send via Resend
      const result = await resend.emails.send({
        from: "Alex at Pellar <alex@pellar.co.uk>",
        to: lead.contact_email!,
        subject: draft.subject,
        html: draft.body_html,
        text: draft.body_text,
        replyTo: "alex@inbound.pellar.co.uk",
        tags: [
          { name: "lead_id", value: lead.id },
          { name: "offering", value: lead.offering || "software" },
        ],
      });

      // Update email status
      await supabaseAdmin
        .from("emails")
        .update({ status: "sent", resend_id: result.data?.id || null })
        .eq("id", emailRecord.id);

      // Move lead to contacted
      await supabaseAdmin
        .from("leads")
        .update({ stage: "contacted" })
        .eq("id", lead.id);

      // Log activity
      await supabaseAdmin.from("activity_log").insert({
        lead_id: lead.id,
        type: "email_sent",
        description: `Auto-sent outreach to ${lead.contact_name} at ${lead.company}: "${draft.subject}"`,
      });

      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Failed to send to ${lead.company}: ${message}`);
      failed++;
    }
  }

  return { sent, failed, skipped, errors };
}
