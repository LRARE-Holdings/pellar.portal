import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTask } from "@/lib/services/tasks";
import type { EntityType } from "@/types";

const VALID_ENTITY: EntityType[] = ["company", "contact", "deal"];

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

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const entity_type =
    typeof body.entity_type === "string" &&
    VALID_ENTITY.includes(body.entity_type as EntityType)
      ? (body.entity_type as EntityType)
      : null;

  const due_at =
    typeof body.due_at === "string" && body.due_at
      ? new Date(body.due_at).toISOString()
      : null;

  try {
    const task = await createTask(
      {
        title: body.title.trim(),
        body: typeof body.body === "string" ? body.body : null,
        due_at,
        entity_type,
        entity_id:
          typeof body.entity_id === "string" && entity_type
            ? body.entity_id
            : null,
        owner_id: user.id,
      },
      user.id,
    );
    return NextResponse.json({ task });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
