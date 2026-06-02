/**
 * site-submissions.ts
 *
 * Fetches all inbound entries from the website: contact form submissions
 * (stored as deals with source = 'contact_form') and booking requests.
 * Returns a unified, newest-first list for the Inbound page.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type SubmissionType = "contact_form" | "booking";

export interface SiteSubmission {
  /** Stable unique key for React rendering */
  key: string;
  type: SubmissionType;
  created_at: string;
  name: string;
  email: string;
  company: string | null;
  interest: string | null;
  message: string | null;
  // Link targets
  deal_id: string | null;
  booking_id: string | null;
  // Status display
  deal_stage: string | null;
  booking_status: string | null;
  booking_slot: string | null;
}

export async function listSiteSubmissions(
  limit = 200,
): Promise<SiteSubmission[]> {
  const sb = getSupabaseAdmin();

  const [formsRes, bookingsRes] = await Promise.all([
    sb
      .from("deals")
      .select(
        `id, created_at, stage, source_detail, title,
         primary_contact:contacts!primary_contact_id(name, email),
         company:companies(name)`,
      )
      .eq("source", "contact_form")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),

    sb
      .from("bookings")
      .select(
        `id, created_at, visitor_name, visitor_email, visitor_company,
         service_interest, visitor_message, status, slot_start, deal_id`,
      )
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (formsRes.error) throw new Error(formsRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);

  const forms: SiteSubmission[] = (formsRes.data ?? []).map((d) => {
    const detail = (d.source_detail ?? {}) as Record<string, unknown>;
    const contact = d.primary_contact as unknown as { name: string; email: string } | null;
    const company = d.company as unknown as { name: string } | null;
    return {
      key: `form-${d.id}`,
      type: "contact_form",
      created_at: d.created_at,
      name: contact?.name ?? firstPart(d.title),
      email: contact?.email ?? "",
      company: company?.name ?? null,
      interest:
        typeof detail.interest_label === "string"
          ? detail.interest_label
          : null,
      message:
        typeof detail.message === "string"
          ? (detail.message as string).slice(0, 300)
          : null,
      deal_id: d.id,
      booking_id: null,
      deal_stage: d.stage,
      booking_status: null,
      booking_slot: null,
    };
  });

  const bookings: SiteSubmission[] = (bookingsRes.data ?? []).map((b) => ({
    key: `booking-${b.id}`,
    type: "booking",
    created_at: b.created_at,
    name: b.visitor_name,
    email: b.visitor_email,
    company: b.visitor_company ?? null,
    interest: b.service_interest?.replace(/_/g, " ") ?? null,
    message: b.visitor_message ?? null,
    deal_id: (b.deal_id as string | null) ?? null,
    booking_id: b.id,
    deal_stage: null,
    booking_status: b.status,
    booking_slot: b.slot_start,
  }));

  return [...forms, ...bookings]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit);
}

function firstPart(title: string): string {
  return title.split("—")[0].trim();
}
