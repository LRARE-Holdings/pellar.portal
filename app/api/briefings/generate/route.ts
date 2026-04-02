import { createClient } from "@/lib/supabase/server";
import { generateBriefing } from "@/lib/services/briefing-gen";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { lead_id?: string };

  if (!body.lead_id) {
    return Response.json({ error: "lead_id is required" }, { status: 400 });
  }

  try {
    const result = await generateBriefing(body.lead_id);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
