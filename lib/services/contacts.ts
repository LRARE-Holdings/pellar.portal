import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Contact, ContactWithCompany, LeadSource } from "@/types";
import { logTimelineEvent } from "@/lib/services/timeline";

export interface CreateContactInput {
  company_id?: string | null;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  is_primary?: boolean;
  do_not_contact?: boolean;
  notes?: string | null;
  source?: LeadSource;
  source_detail?: Record<string, unknown>;
  owner_id?: string | null;
}

export interface UpdateContactInput {
  company_id?: string | null;
  name?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  is_primary?: boolean;
  do_not_contact?: boolean;
  notes?: string | null;
  source?: LeadSource;
  owner_id?: string | null;
}

export async function createContact(
  input: CreateContactInput,
  actorId?: string | null,
): Promise<Contact> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .insert({
      ...input,
      source_detail: input.source_detail ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create contact: ${error?.message}`);
  }

  await logTimelineEvent({
    type: "contact_created",
    company_id: data.company_id,
    contact_id: data.id,
    description: `Contact ${data.name} added`,
    actor_id: actorId ?? null,
    metadata: { source: input.source ?? "manual" },
  });

  return data as Contact;
}

export async function getContact(id: string): Promise<Contact | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch contact: ${error.message}`);
  }
  return (data as Contact) ?? null;
}

export async function getContactWithCompany(
  id: string,
): Promise<ContactWithCompany | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .select("*, company:companies(id, name, industry, location, domain)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch contact: ${error.message}`);
  }
  return data as ContactWithCompany | null;
}

export async function updateContact(
  id: string,
  input: UpdateContactInput,
): Promise<Contact> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to update contact: ${error?.message}`);
  }
  return data as Contact;
}

export async function archiveContact(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("contacts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Failed to archive contact: ${error.message}`);
}

export interface ListContactsOptions {
  search?: string;
  company_id?: string;
  archived?: boolean;
  limit?: number;
  offset?: number;
}

export async function listContacts(
  opts: ListContactsOptions = {},
): Promise<ContactWithCompany[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("contacts")
    .select("*, company:companies(id, name, industry, location, domain)");

  if (opts.archived === true) {
    q = q.not("archived_at", "is", null);
  } else {
    q = q.is("archived_at", null);
  }

  if (opts.company_id) q = q.eq("company_id", opts.company_id);

  if (opts.search) {
    const term = `%${opts.search}%`;
    q = q.or(`name.ilike.${term},email.ilike.${term},title.ilike.${term}`);
  }

  q = q.order("updated_at", { ascending: false });

  if (opts.limit !== undefined) q = q.limit(opts.limit);
  if (opts.offset !== undefined) {
    q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  }

  const { data, error } = await q;
  if (error) {
    throw new Error(`Failed to list contacts: ${error.message}`);
  }
  return (data ?? []) as ContactWithCompany[];
}

export async function findContactByEmail(
  email: string,
): Promise<Contact | null> {
  const sb = getSupabaseAdmin();
  const cleaned = email.trim().toLowerCase();
  if (!cleaned) return null;
  const { data, error } = await sb
    .from("contacts")
    .select("*")
    .ilike("email", cleaned)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to look up contact by email: ${error.message}`);
  }
  return (data as Contact) ?? null;
}

/**
 * Find an existing contact by (company, email) or create one. Used by inbound
 * channels so a contact never gets duplicated within the same company.
 */
export async function upsertContact(
  input: CreateContactInput,
  actorId?: string | null,
): Promise<{ contact: Contact; created: boolean }> {
  if (input.email) {
    const existing = await findContactByEmail(input.email);
    if (existing) return { contact: existing, created: false };
  }
  const contact = await createContact(input, actorId);
  return { contact, created: true };
}
