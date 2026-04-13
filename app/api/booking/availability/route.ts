import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listAvailability,
  upsertAvailability,
  deleteAvailability,
} from "@/lib/services/booking";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const availability = await listAvailability();
    return NextResponse.json({ availability });
  } catch (err) {
    console.error("Failed to list availability:", err);
    return NextResponse.json(
      { error: "Could not load availability" },
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
    id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  };

  if (
    body.day_of_week < 0 ||
    body.day_of_week > 6 ||
    !body.start_time ||
    !body.end_time
  ) {
    return NextResponse.json(
      { error: "Invalid availability data" },
      { status: 400 },
    );
  }

  try {
    const result = await upsertAvailability(body);
    return NextResponse.json({ availability: result });
  } catch (err) {
    console.error("Failed to save availability:", err);
    return NextResponse.json(
      { error: "Could not save availability" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    await deleteAvailability(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete availability:", err);
    return NextResponse.json(
      { error: "Could not delete availability" },
      { status: 500 },
    );
  }
}
