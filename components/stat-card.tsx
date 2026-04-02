interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
}

export function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-lg border border-warm-gray bg-white p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-light text-ink">{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-stone">{subtitle}</p>
      )}
    </div>
  );
}
