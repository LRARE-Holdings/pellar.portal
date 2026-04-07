import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveDraft, updateDraft } from "@/lib/services/drafts";

/**
 * POST /api/drafts/[id]/approve
 * Body: optional { subject, body_html, body_text, to_address }
 *
 * If body fields are present they're written to the draft as a final user
 * edit before approval. Then approveDraft sends via Resend and creates the
 * immutable email row. Idempotent — a second concurrent call hits the
 * partial unique index and throws.
 */
export async function POST(
  req: Request,
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

  let edits: Record<string, unknown> | null = null;
  try {
    const text = await req.text();
    if (text.length > 0) edits = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (edits) {
      const allowed: Record<string, string> = {};
      for (const k of ["subject", "body_html", "body_text", "to_address"]) {
        if (typeof edits[k] === "string") allowed[k] = edits[k] as string;
      }
      if (Object.keys(allowed).length > 0) {
        await updateDraft(id, allowed);
      }
    }

    const result = await approveDraft(id, user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to approve draft",
      },
      { status: 500 },
    );
  }
}
