import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/search?q=…
 *
 * Powers the cmd+K command palette. Searches companies, contacts, and deals
 * by name with a single roundtrip per type. Returns up to 5 of each.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ companies: [], contacts: [], deals: [] });
  }
  const term = `%${q}%`;

  const [companies, contacts, deals] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, industry")
      .ilike("name", term)
      .is("archived_at", null)
      .limit(5),
    supabase
      .from("contacts")
      .select("id, name, email, company:companies(id, name)")
      .or(`name.ilike.${term},email.ilike.${term}`)
      .is("archived_at", null)
      .limit(5),
    supabase
      .from("deals")
      .select("id, title, stage, company:companies(id, name)")
      .ilike("title", term)
      .is("archived_at", null)
      .limit(5),
  ]);

  return NextResponse.json({
    companies: companies.data ?? [],
    contacts: contacts.data ?? [],
    deals: deals.data ?? [],
  });
}
