import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discardDraft } from "@/lib/services/drafts";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const draft = await discardDraft(id, user.id);
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to discard draft",
      },
      { status: 500 },
    );
  }
}
