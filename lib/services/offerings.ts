import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Offering } from "@/types";

export async function listOfferings(): Promise<Offering[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("offerings")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true });
  if (error) {
    throw new Error(`Failed to list offerings: ${error.message}`);
  }
  return (data ?? []) as Offering[];
}

export async function getOfferingBySlug(
  slug: string,
): Promise<Offering | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("offerings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to look up offering: ${error.message}`);
  }
  return (data as Offering) ?? null;
}

export async function getOffering(id: string): Promise<Offering | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("offerings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch offering: ${error.message}`);
  }
  return (data as Offering) ?? null;
}
