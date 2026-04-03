import { runFollowups } from "@/lib/services/followup";
import { runAutoOutreach } from "@/lib/services/auto-outreach";

export async function GET(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Auto-send outreach to identified leads that haven't been emailed yet
  const outreach = await runAutoOutreach();

  // 2. Follow up on contacted leads that haven't responded
  const followups = await runFollowups();

  return Response.json({ outreach, followups });
}
