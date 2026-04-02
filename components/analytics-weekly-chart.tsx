import type { WeeklyTrend } from "@/types";

interface WeeklyChartProps {
  trends: WeeklyTrend[];
}

export function WeeklyChart({ trends }: WeeklyChartProps) {
  const recent = trends.slice(-8);
  const maxValue = Math.max(
    ...recent.flatMap((t) => [
      t.leads_discovered,
      t.emails_sent,
      t.responses_received,
    ]),
    1,
  );

  return (
    <div className="rounded-lg border border-warm-gray bg-white p-5">
      <div className="mb-4 flex gap-5">
        <LegendItem color="bg-forest" label="Leads" />
        <LegendItem color="bg-sage" label="Emails" />
        <LegendItem color="bg-stone" label="Responses" />
      </div>

      <div className="flex items-end gap-3" style={{ height: "220px" }}>
        {recent.map((week) => (
          <div
            key={week.week_label}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div
              className="flex w-full items-end justify-center gap-1"
              style={{ height: "190px" }}
            >
              <Bar
                value={week.leads_discovered}
                max={maxValue}
                color="bg-forest"
              />
              <Bar value={week.emails_sent} max={maxValue} color="bg-sage" />
              <Bar
                value={week.responses_received}
                max={maxValue}
                color="bg-stone"
              />
            </div>
            <span className="text-[11px] text-stone">
              {week.week_label.replace(/^\d{4}-/, "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const heightPct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex w-full flex-col items-center">
      {value > 0 && (
        <span className="mb-0.5 text-[10px] font-medium text-ink">
          {value}
        </span>
      )}
      <div
        className={`w-full rounded-t ${color}`}
        style={{ height: `${Math.max(heightPct, value > 0 ? 2 : 0)}%`, minHeight: value > 0 ? "4px" : "0" }}
      />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded ${color}`} />
      <span className="text-[11px] font-medium text-stone">{label}</span>
    </span>
  );
}
