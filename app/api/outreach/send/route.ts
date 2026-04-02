import { createClient } from "@/lib/supabase/server";
import { sendOutreachEmail } from "@/lib/services/email-sender";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    lead_id?: string;
    custom_subject?: string | null;
    custom_body?: string | null;
  };

  if (!body.lead_id) {
    return Response.json({ error: "lead_id is required" }, { status: 400 });
  }

  try {
    const result = await sendOutreachEmail(
      body.lead_id,
      body.custom_subject,
      body.custom_body,
    );
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
