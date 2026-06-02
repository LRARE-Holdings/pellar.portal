import Link from "next/link";
import { listSiteSubmissions } from "@/lib/services/site-submissions";
import { relativeTime, dateTime, dealStageVariant } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const BOOKING_STATUS_STYLE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  confirmed: { bg: "bg-light-sage", text: "text-forest", label: "Confirmed" },
  completed: { bg: "bg-forest/10", text: "text-forest", label: "Completed" },
  cancelled: { bg: "bg-red-50", text: "text-red-600", label: "Cancelled" },
  no_show: { bg: "bg-amber-50", text: "text-amber-700", label: "No show" },
};

export default async function InboundPage() {
  const submissions = await listSiteSubmissions(200);

  const formCount = submissions.filter((s) => s.type === "contact_form").length;
  const bookingCount = submissions.filter((s) => s.type === "booking").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-normal text-ink">Inbound</h1>
          <p className="mt-1 text-[13px] text-stone">
            Everything from the website. {formCount} contact form{" "}
            {formCount === 1 ? "submission" : "submissions"}, {bookingCount}{" "}
            booking{bookingCount === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-warm-gray bg-white p-12 text-center">
          <p className="text-[13px] text-stone">
            Nothing yet. Submissions from the contact form and booking widget
            will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-warm-gray bg-white">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-warm-gray bg-cream">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  When
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Type
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Person
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Company
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Interest
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Message
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const detailHref =
                  s.type === "booking" && s.booking_id
                    ? `/bookings`
                    : s.deal_id
                      ? `/deals/${s.deal_id}`
                      : null;

                return (
                  <tr
                    key={s.key}
                    className="border-b border-warm-gray/60 last:border-0 hover:bg-cream/50"
                  >
                    {/* When */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div
                        className="text-ink"
                        title={
                          s.type === "booking" && s.booking_slot
                            ? `Slot: ${dateTime(s.booking_slot)}`
                            : undefined
                        }
                      >
                        {relativeTime(s.created_at)}
                      </div>
                      {s.type === "booking" && s.booking_slot && (
                        <div className="mt-0.5 text-[11px] text-stone">
                          {dateTime(s.booking_slot)}
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      {s.type === "booking" ? (
                        <span className="inline-block rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-forest">
                          Booking
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-stone">
                          Form
                        </span>
                      )}
                    </td>

                    {/* Person */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{s.name}</div>
                      <div className="mt-0.5 text-[11px] text-stone">
                        <a
                          href={`mailto:${s.email}`}
                          className="hover:text-forest"
                        >
                          {s.email}
                        </a>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3 text-stone">
                      {s.company ?? (
                        <span className="text-stone/40">—</span>
                      )}
                    </td>

                    {/* Interest */}
                    <td className="px-4 py-3 capitalize text-stone">
                      {s.interest ?? (
                        <span className="text-stone/40">—</span>
                      )}
                    </td>

                    {/* Message */}
                    <td className="max-w-[260px] px-4 py-3">
                      {s.message ? (
                        <p className="line-clamp-2 text-stone">{s.message}</p>
                      ) : (
                        <span className="text-stone/40">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.type === "booking" && s.booking_status && (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] ${
                              (
                                BOOKING_STATUS_STYLE[s.booking_status] ??
                                BOOKING_STATUS_STYLE.confirmed
                              ).bg
                            } ${
                              (
                                BOOKING_STATUS_STYLE[s.booking_status] ??
                                BOOKING_STATUS_STYLE.confirmed
                              ).text
                            }`}
                          >
                            {(
                              BOOKING_STATUS_STYLE[s.booking_status] ??
                              BOOKING_STATUS_STYLE.confirmed
                            ).label}
                          </span>
                        )}
                        {s.deal_stage && (
                          <Badge variant={dealStageVariant(s.deal_stage)}>
                            {s.deal_stage}
                          </Badge>
                        )}
                        {detailHref && (
                          <Link
                            href={detailHref}
                            className="text-[11px] font-medium text-forest hover:underline"
                          >
                            View
                          </Link>
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
