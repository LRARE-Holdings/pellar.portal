import { supabaseAdmin } from "@/lib/supabase/admin";
import { draftInitialEmail } from "@/lib/services/email-drafter";
import type { Lead } from "@/types";

const DAILY_LIMIT = 50;
const MIN_SCORE = 60;

interface AutoOutreachResult {
  drafted: number;
  failed: number;
  skipped: number;
  errors: string[];
}

async function getDraftedTodayCount(): Promise<number> {
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
  let drafted = 0;
  let failed = 0;

  // 0. Weekdays only
  const day = new Date().getUTCDay();
  if (day === 0 || day === 6) {
    return { drafted: 0, failed: 0, skipped: 0, errors: [] };
  }

  // 1. Check remaining daily budget
  const draftedToday = await getDraftedTodayCount();
  const remaining = DAILY_LIMIT - draftedToday;

  if (remaining <= 0) {
    return { drafted: 0, failed: 0, skipped: 0, errors: ["Daily limit already reached"] };
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
    return { drafted: 0, failed: 0, skipped: 0, errors: [queryError?.message || "Failed to query leads"] };
  }

  // 3. Draft outreach for each eligible lead (do not send)
  for (const row of leads) {
    const lead = row as Lead;

    try {
      const draft = await draftInitialEmail(lead);

      const { error: insertError } = await supabaseAdmin
        .from("emails")
        .insert({
          lead_id: lead.id,
          direction: "outbound",
          status: "pending_review",
          from_address: "alex@pellar.co.uk",
          to_address: lead.contact_email,
          subject: draft.subject,
          body_html: draft.body_html,
          body_text: draft.body_text,
        });

      if (insertError) {
        errors.push(`Failed to create draft for ${lead.company}: ${insertError.message}`);
        failed++;
        continue;
      }

      drafted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Failed to draft for ${lead.company}: ${message}`);
      failed++;
    }
  }

  return { drafted, failed, skipped: 0, errors };
}
