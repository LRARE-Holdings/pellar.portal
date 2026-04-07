import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { EntityType, Tag } from "@/types";

export async function listAllTags(): Promise<Tag[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("tags")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to list tags: ${error.message}`);
  return (data ?? []) as Tag[];
}

export async function getOrCreateTag(name: string, color?: string): Promise<Tag> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("tags")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing as Tag;

  const { data, error } = await sb
    .from("tags")
    .insert({ name, color: color ?? null })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to create tag: ${error?.message}`);
  }
  return data as Tag;
}

export async function attachTag(
  tagId: string,
  entity_type: EntityType,
  entity_id: string,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("entity_tags")
    .upsert({ tag_id: tagId, entity_type, entity_id });
  if (error) throw new Error(`Failed to attach tag: ${error.message}`);
}

export async function detachTag(
  tagId: string,
  entity_type: EntityType,
  entity_id: string,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("entity_tags")
    .delete()
    .eq("tag_id", tagId)
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id);
  if (error) throw new Error(`Failed to detach tag: ${error.message}`);
}

export async function listTagsForEntity(
  entity_type: EntityType,
  entity_id: string,
): Promise<Tag[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("entity_tags")
    .select("tag:tags(*)")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id);
  if (error) throw new Error(`Failed to list tags: ${error.message}`);
  // Supabase returns the joined relation as an array; flatten it.
  const rows = (data ?? []) as Array<{ tag: Tag | Tag[] | null }>;
  return rows
    .flatMap((r) => (Array.isArray(r.tag) ? r.tag : r.tag ? [r.tag] : []))
    .filter((t): t is Tag => t != null);
}
