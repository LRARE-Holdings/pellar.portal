import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNote } from "@/lib/services/notes";
import type { EntityType } from "@/types";

const VALID: EntityType[] = ["company", "contact", "deal"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.entity_type !== "string" || !VALID.includes(body.entity_type as EntityType)) {
    return NextResponse.json({ error: "valid entity_type required" }, { status: 400 });
  }
  if (typeof body.entity_id !== "string") {
    return NextResponse.json({ error: "entity_id required" }, { status: 400 });
  }
  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  try {
    const note = await createNote({
      entity_type: body.entity_type as EntityType,
      entity_id: body.entity_id,
      body: body.body.trim(),
      author_id: user.id,
    });
    return NextResponse.json({ note });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
