import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCompany } from "@/lib/services/companies";
import type { LeadSource } from "@/types";

const VALID_SOURCES: LeadSource[] = [
  "contact_form",
  "referral",
  "content",
  "linkedin",
  "event",
  "outbound",
  "discovery",
  "manual",
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

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const source =
    typeof body.source === "string" &&
    VALID_SOURCES.includes(body.source as LeadSource)
      ? (body.source as LeadSource)
      : "manual";

  try {
    const company = await createCompany(
      {
        name: body.name.trim(),
        website: typeof body.website === "string" ? body.website : null,
        industry: typeof body.industry === "string" ? body.industry : null,
        location: typeof body.location === "string" ? body.location : null,
        phone: typeof body.phone === "string" ? body.phone : null,
        linkedin_url:
          typeof body.linkedin_url === "string" ? body.linkedin_url : null,
        source,
        owner_id: user.id,
      },
      user.id,
    );
    return NextResponse.json({ company });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
