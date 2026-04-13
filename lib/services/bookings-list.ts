import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Booking, BookingStatus } from "@/types";

export interface BookingFilters {
  status?: BookingStatus | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
}

export interface BookingWithRelations extends Booking {
  company?: { id: string; name: string } | null;
  contact?: { id: string; name: string; email: string } | null;
  deal?: { id: string; title: string; stage: string } | null;
}

export async function listBookings(
  filters: BookingFilters = {},
): Promise<BookingWithRelations[]> {
  const sb = getSupabaseAdmin();

  let q = sb
    .from("bookings")
    .select(
      "*, company:companies(id, name), contact:contacts(id, name, email), deal:deals(id, title, stage)",
    )
    .order("slot_start", { ascending: false });

  if (filters.status) {
    q = q.eq("status", filters.status);
  }
  if (filters.from) {
    q = q.gte("slot_start", filters.from);
  }
  if (filters.to) {
    q = q.lte("slot_start", filters.to);
  }
  if (filters.search) {
    q = q.or(
      `visitor_name.ilike.%${filters.search}%,visitor_email.ilike.%${filters.search}%,visitor_company.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(`Failed to list bookings: ${error.message}`);
  return (data ?? []) as BookingWithRelations[];
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<Booking> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to update booking: ${error?.message}`);
  }
  return data as Booking;
}
