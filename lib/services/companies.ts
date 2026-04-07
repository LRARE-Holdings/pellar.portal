import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  Company,
  CompanyEngagement,
  CompanyWithEngagement,
  Contact,
  LeadSource,
} from "@/types";
import { logTimelineEvent } from "@/lib/services/timeline";

export interface CreateCompanyInput {
  name: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  social_links?: Record<string, string>;
  google_rating?: number | null;
  google_reviews?: number | null;
  estimated_revenue?: string | null;
  estimated_employees?: number | null;
  company_age_years?: number | null;
  company_number?: string | null;
  source?: LeadSource;
  source_detail?: Record<string, unknown>;
  fit_score?: number | null;
  frustration_hypothesis?: string | null;
  notes?: string | null;
  owner_id?: string | null;
}

export interface UpdateCompanyInput {
  name?: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  social_links?: Record<string, string>;
  google_rating?: number | null;
  google_reviews?: number | null;
  estimated_revenue?: string | null;
  estimated_employees?: number | null;
  company_age_years?: number | null;
  company_number?: string | null;
  source?: LeadSource;
  source_detail?: Record<string, unknown>;
  fit_score?: number | null;
  frustration_hypothesis?: string | null;
  notes?: string | null;
  owner_id?: string | null;
}

export interface ListCompaniesOptions {
  search?: string;
  industry?: string;
  source?: LeadSource;
  archived?: boolean;
  limit?: number;
  offset?: number;
}

export async function createCompany(
  input: CreateCompanyInput,
  actorId?: string | null,
): Promise<Company> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .insert({
      ...input,
      social_links: input.social_links ?? {},
      source_detail: input.source_detail ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create company: ${error?.message}`);
  }

  await logTimelineEvent({
    type: "company_created",
    company_id: data.id,
    description: `Company ${data.name} created`,
    actor_id: actorId ?? null,
    metadata: { source: input.source ?? "manual" },
  });

  return data as Company;
}

export async function getCompany(id: string): Promise<Company | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch company: ${error.message}`);
  }
  return (data as Company) ?? null;
}

export async function getCompanyWithRelations(
  id: string,
): Promise<CompanyWithEngagement | null> {
  const sb = getSupabaseAdmin();

  const [companyRes, engagementRes, contactsRes, dealsRes] = await Promise.all([
    sb.from("companies").select("*").eq("id", id).maybeSingle(),
    sb.from("company_engagement").select("*").eq("company_id", id).maybeSingle(),
    sb
      .from("contacts")
      .select("*")
      .eq("company_id", id)
      .is("archived_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
    sb
      .from("deals")
      .select("value, stage, archived_at")
      .eq("company_id", id)
      .is("archived_at", null),
  ]);

  if (companyRes.error || !companyRes.data) return null;

  const contacts = (contactsRes.data ?? []) as Contact[];
  const deals = (dealsRes.data ?? []) as Array<{
    value: number | null;
    stage: string;
    archived_at: string | null;
  }>;

  return {
    ...(companyRes.data as Company),
    engagement: (engagementRes.data as CompanyEngagement) ?? null,
    primary_contact: contacts.find((c) => c.is_primary) ?? contacts[0] ?? null,
    active_deal_count: deals.filter(
      (d) => !["won", "lost"].includes(d.stage),
    ).length,
    total_pipeline_value: deals
      .filter((d) => !["won", "lost"].includes(d.stage))
      .reduce((sum, d) => sum + (d.value ?? 0), 0),
  };
}

export async function updateCompany(
  id: string,
  input: UpdateCompanyInput,
): Promise<Company> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update company: ${error?.message}`);
  }
  return data as Company;
}

export async function archiveCompany(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("companies")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to archive company: ${error.message}`);
  }
}

export async function unarchiveCompany(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("companies")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to unarchive company: ${error.message}`);
  }
}

export async function listCompanies(
  opts: ListCompaniesOptions = {},
): Promise<Company[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("companies").select("*");

  if (opts.archived === true) {
    q = q.not("archived_at", "is", null);
  } else if (opts.archived === false || opts.archived === undefined) {
    q = q.is("archived_at", null);
  }

  if (opts.industry) {
    q = q.eq("industry", opts.industry);
  }
  if (opts.source) {
    q = q.eq("source", opts.source);
  }
  if (opts.search) {
    const term = `%${opts.search}%`;
    q = q.or(`name.ilike.${term},domain.ilike.${term},industry.ilike.${term}`);
  }

  q = q.order("updated_at", { ascending: false });

  if (opts.limit !== undefined) q = q.limit(opts.limit);
  if (opts.offset !== undefined) {
    q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  }

  const { data, error } = await q;
  if (error) {
    throw new Error(`Failed to list companies: ${error.message}`);
  }
  return (data ?? []) as Company[];
}

export async function findCompanyByDomain(
  domain: string,
): Promise<Company | null> {
  const sb = getSupabaseAdmin();
  const cleaned = normaliseDomain(domain);
  if (!cleaned) return null;
  const { data, error } = await sb
    .from("companies")
    .select("*")
    .eq("domain", cleaned)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to look up company by domain: ${error.message}`);
  }
  return (data as Company) ?? null;
}

export async function findCompanyByName(name: string): Promise<Company | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .select("*")
    .ilike("name", name)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to look up company by name: ${error.message}`);
  }
  return (data as Company) ?? null;
}

/**
 * Find an existing company by domain or company number, otherwise create one.
 * Used by inbound channels (contact form, email forwarding) so a single
 * organisation never gets duplicated when its details arrive from different
 * sources.
 */
export async function upsertCompany(
  input: CreateCompanyInput,
  actorId?: string | null,
): Promise<{ company: Company; created: boolean }> {
  const domain = input.domain ?? normaliseDomain(input.website ?? "");
  if (domain) {
    const existing = await findCompanyByDomain(domain);
    if (existing) return { company: existing, created: false };
  }
  if (input.company_number) {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("companies")
      .select("*")
      .eq("company_number", input.company_number)
      .is("archived_at", null)
      .maybeSingle();
    if (data) return { company: data as Company, created: false };
  }
  const byName = await findCompanyByName(input.name);
  if (byName) return { company: byName, created: false };

  const company = await createCompany(input, actorId);
  return { company, created: true };
}

function normaliseDomain(input: string): string | null {
  if (!input) return null;
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/^www\./, "");
  cleaned = cleaned.split("/")[0];
  cleaned = cleaned.split("?")[0];
  cleaned = cleaned.split("#")[0];
  return cleaned.length > 0 ? cleaned : null;
}
