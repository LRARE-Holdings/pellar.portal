export default function BriefingsLoading() {
  return (
    <div>
      <div className="h-8 w-32 animate-pulse rounded bg-warm-gray" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-warm-gray bg-white"
          />
        ))}
      </div>
    </div>
  );
}
