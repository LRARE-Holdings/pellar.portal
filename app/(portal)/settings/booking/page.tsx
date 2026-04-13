import { listAvailability, listOverrides } from "@/lib/services/booking";
import { BookingAdminGrid } from "@/components/booking-admin-grid";

export const dynamic = "force-dynamic";

export default async function BookingSettingsPage() {
  const [availability, overrides] = await Promise.all([
    listAvailability(),
    listOverrides(),
  ]);

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Booking Settings</h1>
      <p className="mt-1 text-sm text-stone">
        Configure when prospects can book calls via pellar.co.uk/book.
      </p>

      <div className="mt-6">
        <BookingAdminGrid
          initialAvailability={availability}
          initialOverrides={overrides}
        />
      </div>
    </div>
  );
}
