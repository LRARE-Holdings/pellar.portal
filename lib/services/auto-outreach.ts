import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendOutreachEmail } from "@/lib/services/email-sender";
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
    .in("status", ["sent", "delivered", "opened", "queued"])
    .gte("created_at", todayStart.toISOString());

  return count || 0;
}

export async function runAutoOutreach(): Promise<AutoOutreachResult> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  // 0. Weekdays only
  const day = new Date().getUTCDay();
  if (day === 0 || day === 6) {
    return { sent: 0, failed: 0, skipped: 0, errors: [] };
  }

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

  // 3. Draft and send outreach for each eligible lead
  for (const row of leads) {
    const lead = row as Lead;

    try {
      await sendOutreachEmail(lead.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Failed to send to ${lead.company}: ${message}`);
      failed++;
    }

    // Delay between sends to avoid Resend rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { sent, failed, skipped: 0, errors };
}
