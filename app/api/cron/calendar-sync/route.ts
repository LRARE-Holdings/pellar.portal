import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncCalendarForUser } from "@/lib/services/calendar-sync";

/**
 * Vercel cron — pulls Google Calendar events for every user with a connected
 * Google account. Runs every 15 minutes per vercel.json.
 */
export async function GET(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { data: tokens } = await sb
    .from("oauth_tokens")
    .select("user_id")
    .eq("provider", "google");

  const results: Array<{ user_id: string; result: unknown; error?: string }> = [];
  for (const token of tokens ?? []) {
    try {
      const result = await syncCalendarForUser(token.user_id);
      results.push({ user_id: token.user_id, result });
    } catch (err) {
      results.push({
        user_id: token.user_id,
        result: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Response.json({ users: results.length, results });
}
