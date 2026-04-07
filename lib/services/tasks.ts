import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { EntityType, Task } from "@/types";
import { logTimelineEvent } from "@/lib/services/timeline";

export interface CreateTaskInput {
  title: string;
  body?: string | null;
  due_at?: string | null;
  entity_type?: EntityType | null;
  entity_id?: string | null;
  owner_id?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  body?: string | null;
  due_at?: string | null;
  snoozed_until?: string | null;
}

export async function createTask(
  input: CreateTaskInput,
  actorId?: string | null,
): Promise<Task> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("tasks").insert(input).select().single();
  if (error || !data) {
    throw new Error(`Failed to create task: ${error?.message}`);
  }

  if (input.entity_type && input.entity_id) {
    await logTimelineEvent({
      type: "task_created",
      [input.entity_type === "company" ? "company_id" : "company_id"]: undefined,
      ...(input.entity_type === "company" && { company_id: input.entity_id }),
      ...(input.entity_type === "contact" && { contact_id: input.entity_id }),
      ...(input.entity_type === "deal" && { deal_id: input.entity_id }),
      description: `Task: ${data.title}`,
      actor_id: actorId ?? null,
      metadata: { task_id: data.id, due_at: data.due_at },
    });
  }

  return data as Task;
}

export async function getTask(id: string): Promise<Task | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch task: ${error.message}`);
  return (data as Task) ?? null;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
): Promise<Task> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("tasks")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to update task: ${error?.message}`);
  }
  return data as Task;
}

export async function completeTask(
  id: string,
  actorId?: string | null,
): Promise<Task> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("tasks")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to complete task: ${error?.message}`);
  }

  const task = data as Task;
  if (task.entity_type && task.entity_id) {
    await logTimelineEvent({
      type: "task_completed",
      ...(task.entity_type === "company" && { company_id: task.entity_id }),
      ...(task.entity_type === "contact" && { contact_id: task.entity_id }),
      ...(task.entity_type === "deal" && { deal_id: task.entity_id }),
      description: `Task completed: ${task.title}`,
      actor_id: actorId ?? null,
      metadata: { task_id: task.id },
    });
  }
  return task;
}

export async function snoozeTask(id: string, until: string): Promise<Task> {
  return updateTask(id, { snoozed_until: until });
}

export async function deleteTask(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}

export interface ListTasksOptions {
  owner_id?: string;
  entity_type?: EntityType;
  entity_id?: string;
  show_completed?: boolean;
  show_snoozed?: boolean;
  due_before?: string;
  limit?: number;
}

export async function listTasks(
  opts: ListTasksOptions = {},
): Promise<Task[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("tasks").select("*");

  if (!opts.show_completed) {
    q = q.is("completed_at", null);
  }
  if (!opts.show_snoozed) {
    const now = new Date().toISOString();
    q = q.or(`snoozed_until.is.null,snoozed_until.lt.${now}`);
  }
  if (opts.owner_id) q = q.eq("owner_id", opts.owner_id);
  if (opts.entity_type && opts.entity_id) {
    q = q.eq("entity_type", opts.entity_type).eq("entity_id", opts.entity_id);
  }
  if (opts.due_before) q = q.lte("due_at", opts.due_before);

  q = q.order("due_at", { ascending: true, nullsFirst: false });
  if (opts.limit !== undefined) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(`Failed to list tasks: ${error.message}`);
  return (data ?? []) as Task[];
}
