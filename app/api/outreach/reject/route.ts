import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  const { error } = await supabaseAdmin
    .from("emails")
    .delete()
    .eq("id", body.email_id)
    .eq("status", "pending_review");

  if (error) {
    return Response.json(
      { error: "Failed to reject email" },
      { status: 500 },
    );
  }

  return Response.json({ status: "rejected" });
}
