import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteOverride } from "@/lib/services/booking";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteOverride(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete override:", err);
    return NextResponse.json(
      { error: "Could not delete override" },
      { status: 500 },
    );
  }
}
