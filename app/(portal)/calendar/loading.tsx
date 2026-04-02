export default function CalendarLoading() {
  return (
    <div>
      <div className="h-8 w-32 animate-pulse rounded bg-warm-gray" />
      <div className="mt-6 h-8 w-48 animate-pulse rounded bg-warm-gray" />
      <div className="mt-3 h-[500px] animate-pulse rounded-lg border border-warm-gray bg-white" />
      <div className="mt-8 h-6 w-40 animate-pulse rounded bg-warm-gray" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-warm-gray bg-white"
          />
        ))}
      </div>
    </div>
  );
}
