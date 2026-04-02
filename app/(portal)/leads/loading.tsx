export default function LeadsLoading() {
  return (
    <div>
      <div className="h-8 w-24 animate-pulse rounded bg-warm-gray" />
      <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-warm-gray" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg border border-warm-gray bg-white"
          />
        ))}
      </div>
    </div>
  );
}
