export default function AnalyticsLoading() {
  return (
    <div>
      <div className="h-8 w-36 animate-pulse rounded bg-warm-gray" />
      <div className="mt-6 grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-warm-gray bg-white"
          />
        ))}
      </div>
      <div className="mt-8 h-6 w-32 animate-pulse rounded bg-warm-gray" />
      <div className="mt-3 h-64 animate-pulse rounded-lg border border-warm-gray bg-white" />
      <div className="mt-8 h-6 w-40 animate-pulse rounded bg-warm-gray" />
      <div className="mt-3 h-48 animate-pulse rounded-lg border border-warm-gray bg-white" />
    </div>
  );
}
