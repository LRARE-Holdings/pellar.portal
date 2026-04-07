import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { EntityType, Note } from "@/types";
import { logTimelineEvent } from "@/lib/services/timeline";

export interface CreateNoteInput {
  entity_type: EntityType;
  entity_id: string;
  body: string;
  pinned?: boolean;
  author_id?: string | null;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("notes").insert(input).select().single();
  if (error || !data) {
    throw new Error(`Failed to create note: ${error?.message}`);
  }

  await logTimelineEvent({
    type: "note_added",
    ...(input.entity_type === "company" && { company_id: input.entity_id }),
    ...(input.entity_type === "contact" && { contact_id: input.entity_id }),
    ...(input.entity_type === "deal" && { deal_id: input.entity_id }),
    description: input.body.length > 80 ? input.body.slice(0, 80) + "…" : input.body,
    actor_id: input.author_id ?? null,
    metadata: { note_id: data.id },
  });

  return data as Note;
}

export async function updateNote(id: string, body: string): Promise<Note> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("notes")
    .update({ body })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to update note: ${error?.message}`);
  }
  return data as Note;
}

export async function pinNote(id: string, pinned: boolean): Promise<Note> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("notes")
    .update({ pinned })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to pin note: ${error?.message}`);
  }
  return data as Note;
}

export async function deleteNote(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("notes").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete note: ${error.message}`);
}

export async function listNotes(
  entity_type: EntityType,
  entity_id: string,
): Promise<Note[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list notes: ${error.message}`);
  return (data ?? []) as Note[];
}
