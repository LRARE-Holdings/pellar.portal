export default function OutreachLoading() {
  return (
    <div>
      <div className="h-8 w-32 animate-pulse rounded bg-warm-gray" />
      <div className="mt-6 grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-warm-gray bg-white"
          />
        ))}
      </div>
    </div>
  );
}
