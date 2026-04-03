import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import type { Email, Lead } from "@/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { email_id?: string };

  if (!body.email_id) {
    return Response.json({ error: "email_id is required" }, { status: 400 });
  }

  // 1. Fetch the pending email
  const { data: emailRow, error: emailError } = await supabaseAdmin
    .from("emails")
    .select("*")
    .eq("id", body.email_id)
    .eq("status", "pending_review")
    .single();

  if (emailError || !emailRow) {
    return Response.json(
      { error: "Email not found or not pending review" },
      { status: 404 },
    );
  }

  const email = emailRow as Email;

  // 2. Fetch the lead
  const { data: leadRow } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", email.lead_id)
    .single();

  const lead = leadRow as Lead | null;

  // 3. Send via Resend
  try {
    const result = await resend.emails.send({
      from: "Alex at Pellar <alex@pellar.co.uk>",
      to: email.to_address,
      subject: email.subject,
      html: email.body_html || "",
      text: email.body_text || "",
      replyTo: "alex@inbound.pellar.co.uk",
      tags: [
        { name: "lead_id", value: email.lead_id },
        { name: "offering", value: lead?.offering || "software" },
      ],
    });

    // 4. Update email status to sent
    await supabaseAdmin
      .from("emails")
      .update({
        status: "sent",
        resend_id: result.data?.id || null,
      })
      .eq("id", email.id);

    // 5. Move lead to contacted
    if (lead && lead.stage === "identified") {
      await supabaseAdmin
        .from("leads")
        .update({ stage: "contacted" })
        .eq("id", lead.id);
    }

    // 6. Log activity
    await supabaseAdmin.from("activity_log").insert({
      lead_id: email.lead_id,
      type: "email_sent",
      description: `Outreach sent to ${lead?.contact_name || email.to_address} at ${lead?.company || "unknown"}: "${email.subject}"`,
    });

    return Response.json({
      email_id: email.id,
      resend_id: result.data?.id || null,
      status: "sent",
    });
  } catch (err) {
    await supabaseAdmin
      .from("emails")
      .update({ status: "failed" })
      .eq("id", email.id);

    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 },
    );
  }
}
