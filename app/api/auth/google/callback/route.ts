import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCode } from "@/lib/clients/google-calendar";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/calendar?error=no_code", req.url));
  }

  // Verify the user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify state matches user ID
  if (state !== user.id) {
    return NextResponse.redirect(
      new URL("/calendar?error=invalid_state", req.url),
    );
  }

  try {
    const tokens = await exchangeCode(code);

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    // Upsert tokens
    await supabaseAdmin.from("oauth_tokens").upsert(
      {
        user_id: user.id,
        provider: "google",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: "https://www.googleapis.com/auth/calendar.events",
      },
      { onConflict: "user_id,provider" },
    );

    return NextResponse.redirect(
      new URL("/calendar?connected=true", req.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/calendar?error=token_exchange_failed", req.url),
    );
  }
}
