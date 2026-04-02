import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { draftFollowup1, draftFollowup2 } from "@/lib/services/email-drafter";
import type { Lead, Email, FollowupResult } from "@/types";

export async function runFollowups(): Promise<FollowupResult> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // 1. Find leads eligible for follow-up
  const { data: contactedLeads } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("stage", "contacted")
    .eq("stale", false)
    .lt("followup_count", 2);

  const typedLeads = (contactedLeads || []) as Lead[];
  const details: Array<{ lead_id: string; company: string; sequence: number }> =
    [];
  let staleCount = 0;

  for (const lead of typedLeads) {
    // Check most recent outbound email
    const { data: lastOutbound } = await supabaseAdmin
      .from("emails")
      .select("*")
      .eq("lead_id", lead.id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!lastOutbound) continue;
    const typedLastOutbound = lastOutbound as Email;

    const lastSentDate = new Date(typedLastOutbound.created_at);
    if (lastSentDate > threeDaysAgo) continue; // Not yet 3 days

    // Check if any inbound email exists
    const { count: inboundCount } = await supabaseAdmin
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("direction", "inbound");

    if ((inboundCount || 0) > 0) continue; // Has response, skip

    if (!lead.contact_email) continue;

    // Draft follow-up
    const sequence = lead.followup_count + 1;
    let draft;

    if (sequence === 1) {
      // First follow-up: get previous emails for context
      const { data: prevEmails } = await supabaseAdmin
        .from("emails")
        .select("*")
        .eq("lead_id", lead.id)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(1);

      const prevEmail = (prevEmails || [])[0] as Email | undefined;
      draft = await draftFollowup1(
        lead,
        prevEmail?.subject || "",
        prevEmail?.body_text || "",
      );
    } else {
      draft = await draftFollowup2(lead);
    }

    // Insert email record
    const { data: emailRecord } = await supabaseAdmin
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
        is_followup: true,
      })
      .select()
      .single();

    // Send via Resend
    try {
      const result = await resend.emails.send({
        from: "Alex at Pellar <alex@pellar.co.uk>",
        to: lead.contact_email,
        subject: draft.subject,
        html: draft.body_html,
        text: draft.body_text,
        replyTo: "alex@inbound.pellar.co.uk",
        tags: [
          { name: "lead_id", value: lead.id },
          { name: "offering", value: lead.offering || "software" },
        ],
      });

      if (emailRecord) {
        await supabaseAdmin
          .from("emails")
          .update({ status: "sent", resend_id: result.data?.id || null })
          .eq("id", emailRecord.id);
      }

      // Increment followup_count
      await supabaseAdmin
        .from("leads")
        .update({ followup_count: sequence })
        .eq("id", lead.id);

      // Log activity
      await supabaseAdmin.from("activity_log").insert({
        lead_id: lead.id,
        type: "followup_sent",
        description: `Follow-up ${sequence} sent to ${lead.contact_name} at ${lead.company}`,
        metadata: { sequence },
      });

      details.push({
        lead_id: lead.id,
        company: lead.company,
        sequence,
      });
    } catch {
      if (emailRecord) {
        await supabaseAdmin
          .from("emails")
          .update({ status: "failed" })
          .eq("id", emailRecord.id);
      }
    }
  }

  // 2. Mark stale leads: followup_count >= 2 and last email > 3 days with no response
  const { data: staleCandidate } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("stage", "contacted")
    .eq("stale", false)
    .gte("followup_count", 2);

  for (const lead of (staleCandidate || []) as Lead[]) {
    const { data: lastEmail } = await supabaseAdmin
      .from("emails")
      .select("created_at")
      .eq("lead_id", lead.id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!lastEmail) continue;

    const lastDate = new Date(lastEmail.created_at);
    if (lastDate <= threeDaysAgo) {
      // Check no inbound
      const { count: inboundCount } = await supabaseAdmin
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .eq("direction", "inbound");

      if ((inboundCount || 0) === 0) {
        await supabaseAdmin
          .from("leads")
          .update({ stale: true })
          .eq("id", lead.id);
        staleCount++;
      }
    }
  }

  return {
    followups_sent: details.length,
    leads_marked_stale: staleCount,
    details,
  };
}
