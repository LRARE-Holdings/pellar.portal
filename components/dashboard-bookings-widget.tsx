import Link from "next/link";
import { dateTime } from "@/lib/format";

interface BookingItem {
  id: string;
  visitor_name: string;
  visitor_company: string | null;
  meeting_type: string;
  slot_start: string;
  status: string;
}

interface DashboardBookingsWidgetProps {
  bookings: BookingItem[];
}

const MEETING_TYPE_LABEL: Record<string, string> = {
  google_meet: "Meet",
  in_person: "In person",
};

export function DashboardBookingsWidget({
  bookings,
}: DashboardBookingsWidgetProps) {
  if (bookings.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-stone">
        No upcoming bookings.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-0">
        {bookings.map((booking, idx) => (
          <Link
            key={booking.id}
            href="/bookings"
            className={`flex items-center gap-3 px-1 py-3 transition-colors hover:bg-cream ${
              idx > 0 ? "border-t border-warm-gray" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">
                {booking.visitor_name}
              </p>
              {booking.visitor_company && (
                <p className="mt-0.5 truncate text-[11px] text-stone">
                  {booking.visitor_company}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="text-[12px] font-medium text-ink">
                {dateTime(booking.slot_start)}
              </span>
              <p className="mt-0.5 text-[10px] text-stone">
                {MEETING_TYPE_LABEL[booking.meeting_type] ?? booking.meeting_type}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/bookings"
        className="mt-3 block text-right text-[12px] font-medium text-forest hover:underline"
      >
        View all
      </Link>
    </div>
  );
}
