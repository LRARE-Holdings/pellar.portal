import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  InboxItem,
  InboxItemWithRelations,
} from "@/types";

/**
 * Read the Inbox view and hydrate each item with the related company,
 * contact, and deal in a single round-trip per type.
 */
export async function listInboxItems(
  limit: number = 50,
): Promise<InboxItemWithRelations[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("inbox_items")
    .select("*")
    .order("priority", { ascending: true })
    .order("sort_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load inbox: ${error.message}`);
  }

  const items = (data ?? []) as InboxItem[];
  if (items.length === 0) return [];

  const companyIds = unique(items.map((i) => i.company_id).filter(Boolean));
  const contactIds = unique(items.map((i) => i.contact_id).filter(Boolean));
  const dealIds = unique(items.map((i) => i.deal_id).filter(Boolean));

  const [companies, contacts, deals] = await Promise.all([
    companyIds.length > 0
      ? sb
          .from("companies")
          .select("id, name")
          .in("id", companyIds as string[])
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? sb
          .from("contacts")
          .select("id, name, email")
          .in("id", contactIds as string[])
      : Promise.resolve({ data: [] }),
    dealIds.length > 0
      ? sb
          .from("deals")
          .select("id, title, stage, value")
          .in("id", dealIds as string[])
      : Promise.resolve({ data: [] }),
  ]);

  const companyMap = indexBy(companies.data ?? [], "id");
  const contactMap = indexBy(contacts.data ?? [], "id");
  const dealMap = indexBy(deals.data ?? [], "id");

  return items.map((item) => ({
    ...item,
    company: item.company_id ? companyMap.get(item.company_id) ?? null : null,
    contact: item.contact_id ? contactMap.get(item.contact_id) ?? null : null,
    deal: item.deal_id ? dealMap.get(item.deal_id) ?? null : null,
  })) as InboxItemWithRelations[];
}

export async function getInboxCount(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("inbox_items")
    .select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

function unique<T>(arr: (T | null | undefined)[]): T[] {
  return Array.from(new Set(arr.filter((v): v is T => v != null)));
}

function indexBy<T extends { id: string }>(
  arr: T[],
  key: keyof T,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of arr) {
    map.set(item[key] as unknown as string, item);
  }
  return map;
}
