import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/clients/google-calendar";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUrl = getAuthUrl(user.id);
  return NextResponse.redirect(authUrl);
}
