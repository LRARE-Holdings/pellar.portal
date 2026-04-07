import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDeal } from "@/lib/services/deals";
import type { DealStage } from "@/types";

const VALID_STAGES: DealStage[] = [
  "lead",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

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
  if (typeof body.company_id !== "string") {
    return NextResponse.json({ error: "company_id required" }, { status: 400 });
  }

  const stage =
    typeof body.stage === "string" && VALID_STAGES.includes(body.stage as DealStage)
      ? (body.stage as DealStage)
      : "lead";

  const value =
    body.value !== undefined && body.value !== null && body.value !== ""
      ? Number(body.value)
      : null;
  if (value !== null && Number.isNaN(value)) {
    return NextResponse.json({ error: "value must be numeric" }, { status: 400 });
  }

  try {
    const deal = await createDeal(
      {
        title: body.title.trim(),
        company_id: body.company_id,
        primary_contact_id:
          typeof body.primary_contact_id === "string"
            ? body.primary_contact_id
            : null,
        offering_id:
          typeof body.offering_id === "string" ? body.offering_id : null,
        stage,
        value,
        close_date:
          typeof body.close_date === "string" && body.close_date
            ? body.close_date
            : null,
        owner_id: user.id,
      },
      user.id,
    );
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
