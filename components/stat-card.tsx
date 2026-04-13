export interface TrendIndicator {
  direction: "up" | "down" | "flat";
  value: string;
}

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  trend?: TrendIndicator | null;
}

export function StatCard({ label, value, subtitle, trend }: StatCardProps) {
  return (
    <div className="rounded-lg border border-warm-gray bg-white p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-[28px] font-light text-ink">{value}</p>
        {trend && trend.direction !== "flat" && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold ${
              trend.direction === "up" ? "text-forest" : "text-red-600"
            }`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={trend.direction === "down" ? "rotate-180" : ""}
            >
              <polyline points="1 7 5 3 9 7" />
            </svg>
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-stone">{subtitle}</p>
      )}
    </div>
  );
}
