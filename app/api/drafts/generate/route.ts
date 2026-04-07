import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInitialDraft, generateReplyDraft } from "@/lib/services/drafts";

/**
 * POST /api/drafts/generate
 * Body:
 *   { kind: "initial", deal_id, personal_context? }
 *   { kind: "reply", in_reply_to_email_id, personal_context? }
 *
 * personal_context is free-text Alex types when triggering the draft, e.g.
 * "Sarah introduced us at the NE Tech Show last Tuesday and said you're
 * stuck with a Sage + Excel handoff that costs paralegals an hour a day".
 * It anchors the email's opening — the difference between a generic cold
 * draft and one that earns a reply.
 *
 * Returns the new draft row. Authenticated session required.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const kind = input.kind;
  const personalContext =
    typeof input.personal_context === "string" && input.personal_context.trim()
      ? input.personal_context.slice(0, 2000)
      : null;

  try {
    if (kind === "initial") {
      if (typeof input.deal_id !== "string") {
        return NextResponse.json(
          { error: "deal_id required" },
          { status: 400 },
        );
      }
      const draft = await generateInitialDraft({
        deal_id: input.deal_id,
        owner_id: user.id,
        personal_context: personalContext,
      });
      return NextResponse.json({ draft });
    }
    if (kind === "reply") {
      if (typeof input.in_reply_to_email_id !== "string") {
        return NextResponse.json(
          { error: "in_reply_to_email_id required" },
          { status: 400 },
        );
      }
      const draft = await generateReplyDraft({
        in_reply_to_email_id: input.in_reply_to_email_id,
        owner_id: user.id,
        personal_context: personalContext,
      });
      return NextResponse.json({ draft });
    }
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to generate draft",
      },
      { status: 500 },
    );
  }
}
