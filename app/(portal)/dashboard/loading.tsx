export default function DashboardLoading() {
  return (
    <div>
      <div className="h-8 w-40 animate-pulse rounded bg-warm-gray" />
      <div className="mt-6 grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-warm-gray bg-white"
          />
        ))}
      </div>
    </div>
  );
}
