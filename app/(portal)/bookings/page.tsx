import Link from "next/link";
import { listBookings } from "@/lib/services/bookings-list";
import { dateTime } from "@/lib/format";
import { BookingActions } from "@/components/booking-actions";
import type { BookingStatus } from "@/types";

const STATUS_BADGE: Record<
  BookingStatus,
  { bg: string; text: string; label: string }
> = {
  confirmed: { bg: "bg-light-sage", text: "text-forest", label: "Confirmed" },
  completed: { bg: "bg-forest/10", text: "text-forest", label: "Completed" },
  cancelled: { bg: "bg-red-50", text: "text-red-600", label: "Cancelled" },
  no_show: { bg: "bg-amber-50", text: "text-amber-700", label: "No show" },
};

const MEETING_TYPE_LABEL: Record<string, string> = {
  google_meet: "Google Meet",
  in_person: "In person",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = (sp.status as BookingStatus) || null;
  const search = sp.search || null;

  const bookings = await listBookings({
    status: statusFilter,
    search,
  });

  const statuses: (BookingStatus | "all")[] = [
    "all",
    "confirmed",
    "completed",
    "no_show",
    "cancelled",
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] font-normal text-ink">Bookings</h1>
        <p className="text-[13px] text-stone">
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statuses.map((s) => {
          const isActive =
            s === "all" ? !statusFilter : statusFilter === s;
          const href =
            s === "all"
              ? "/bookings"
              : `/bookings?status=${s}${search ? `&search=${search}` : ""}`;
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.03em] transition-colors ${
                isActive
                  ? "bg-ink text-white"
                  : "border border-warm-gray bg-white text-stone hover:text-ink"
              }`}
            >
              {s === "all" ? "All" : STATUS_BADGE[s]?.label ?? s}
            </Link>
          );
        })}

        <form action="/bookings" method="get" className="w-full flex items-center gap-2 sm:ml-auto sm:w-auto">
          {statusFilter && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          <input
            type="text"
            name="search"
            placeholder="Search name, email, company..."
            defaultValue={search ?? ""}
            className="h-8 w-full rounded-md border border-warm-gray bg-white px-3 text-[13px] text-ink placeholder:text-stone/60 focus:border-forest focus:outline-none sm:w-56"
          />
        </form>
      </div>

      {/* Table */}
      {bookings.length === 0 ? (
        <div className="rounded-lg border border-warm-gray bg-white p-12 text-center">
          <p className="text-[13px] text-stone">No bookings found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-warm-gray bg-white">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-warm-gray bg-cream">
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.05em] text-stone">
                  Visitor
                </th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.05em] text-stone">
                  Company
                </th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.05em] text-stone">
                  Service
                </th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.05em] text-stone">
                  Type
                </th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.05em] text-stone">
                  Slot
                </th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.05em] text-stone">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold text-[11px] uppercase tracking-[0.05em] text-stone">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.confirmed;
                return (
                  <tr
                    key={b.id}
                    className="border-b border-warm-gray/60 last:border-0 hover:bg-cream/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {b.contact ? (
                          <Link
                            href={`/contacts/${b.contact.id}`}
                            className="hover:text-forest"
                          >
                            {b.visitor_name}
                          </Link>
                        ) : (
                          b.visitor_name
                        )}
                      </div>
                      <div className="text-[11px] text-stone">
                        {b.visitor_email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {b.company ? (
                        <Link
                          href={`/companies/${b.company.id}`}
                          className="text-ink hover:text-forest"
                        >
                          {b.company.name}
                        </Link>
                      ) : (
                        <span className="text-stone">
                          {b.visitor_company ?? "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone">
                      {b.service_interest?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-ink">
                        {MEETING_TYPE_LABEL[b.meeting_type] ?? b.meeting_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink">
                      {dateTime(b.slot_start)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BookingActions
                          bookingId={b.id}
                          currentStatus={b.status}
                        />
                        {b.deal && (
                          <Link
                            href={`/deals/${b.deal.id}`}
                            className="text-[11px] font-medium text-forest hover:underline"
                          >
                            Deal
                          </Link>
                        )}
                        {b.google_meet_link && (
                          <a
                            href={b.google_meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-forest hover:underline"
                          >
                            Meet
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
