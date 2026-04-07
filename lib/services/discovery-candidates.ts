import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { upsertCompany } from "@/lib/services/companies";
import { upsertContact } from "@/lib/services/contacts";
import { createDeal } from "@/lib/services/deals";
import { logTimelineEvent } from "@/lib/services/timeline";
import type { DiscoveryCandidate, DiscoveryStatus } from "@/types";

export interface ListCandidatesOptions {
  status?: DiscoveryStatus;
  limit?: number;
}

export async function listCandidates(
  opts: ListCandidatesOptions = {},
): Promise<DiscoveryCandidate[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("discovery_candidates").select("*");
  if (opts.status) q = q.eq("status", opts.status);
  q = q.order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  const { data, error } = await q;
  if (error) {
    throw new Error(`Failed to list discovery candidates: ${error.message}`);
  }
  return (data ?? []) as DiscoveryCandidate[];
}

export async function getCandidate(
  id: string,
): Promise<DiscoveryCandidate | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("discovery_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch candidate: ${error.message}`);
  }
  return (data as DiscoveryCandidate) ?? null;
}

/**
 * Accept a discovery candidate — promotes it to companies + contacts + deals.
 * Marks the candidate as `accepted` and links to the new company.
 */
export async function acceptCandidate(
  id: string,
  actorId: string | null,
): Promise<{ company_id: string; deal_id: string }> {
  const sb = getSupabaseAdmin();
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error(`Candidate ${id} not found`);
  if (candidate.status !== "pending_review") {
    throw new Error(`Candidate is already ${candidate.status}`);
  }

  const { company } = await upsertCompany(
    {
      name: candidate.company_name,
      domain: candidate.domain,
      website: candidate.website,
      industry: candidate.industry,
      location: candidate.location,
      phone: candidate.phone,
      linkedin_url: candidate.linkedin_url,
      google_rating: candidate.google_rating,
      google_reviews: candidate.google_reviews,
      estimated_revenue: candidate.estimated_revenue,
      estimated_employees: candidate.estimated_employees,
      company_age_years: candidate.company_age_years,
      company_number: candidate.company_number,
      source: "discovery",
      source_detail: { candidate_id: id },
      fit_score: candidate.fit_score,
      frustration_hypothesis: candidate.frustration_hypothesis,
      owner_id: actorId,
    },
    actorId,
  );

  let contactId: string | null = null;
  if (candidate.contact_name && candidate.contact_email) {
    const { contact } = await upsertContact(
      {
        company_id: company.id,
        name: candidate.contact_name,
        email: candidate.contact_email,
        title: candidate.contact_title,
        is_primary: true,
        source: "discovery",
        source_detail: { candidate_id: id },
        owner_id: actorId,
      },
      actorId,
    );
    contactId = contact.id;
  }

  const deal = await createDeal(
    {
      company_id: company.id,
      primary_contact_id: contactId,
      offering_id: candidate.suggested_offering_id,
      title: `${candidate.company_name} — discovery`,
      stage: "lead",
      source: "discovery",
      source_detail: { candidate_id: id },
      owner_id: actorId,
    },
    actorId,
  );

  await sb
    .from("discovery_candidates")
    .update({
      status: "accepted",
      promoted_company_id: company.id,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await logTimelineEvent({
    type: "discovery_promoted",
    company_id: company.id,
    contact_id: contactId,
    deal_id: deal.id,
    description: `Promoted from discovery review`,
    actor_id: actorId,
    metadata: { candidate_id: id, fit_score: candidate.fit_score },
  });

  return { company_id: company.id, deal_id: deal.id };
}

export async function rejectCandidate(
  id: string,
  actorId: string | null,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("discovery_candidates")
    .update({
      status: "rejected",
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to reject candidate: ${error.message}`);
  }
}
