import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listOverrides, createOverride } from "@/lib/services/booking";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;

  try {
    const overrides = await listOverrides(from, to);
    return NextResponse.json({ overrides });
  } catch (err) {
    console.error("Failed to list overrides:", err);
    return NextResponse.json(
      { error: "Could not load overrides" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    override_date: string;
    override_type: "available" | "blocked";
    start_time?: string | null;
    end_time?: string | null;
    reason?: string | null;
  };

  if (!body.override_date || !body.override_type) {
    return NextResponse.json(
      { error: "override_date and override_type are required" },
      { status: 400 },
    );
  }

  try {
    const result = await createOverride(body);
    return NextResponse.json({ override: result });
  } catch (err) {
    console.error("Failed to create override:", err);
    return NextResponse.json(
      { error: "Could not create override" },
      { status: 500 },
    );
  }
}
