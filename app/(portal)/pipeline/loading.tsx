export default function PipelineLoading() {
  return (
    <div>
      <div className="h-8 w-28 animate-pulse rounded bg-warm-gray" />
      <div className="mt-6 flex gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-48 w-56 shrink-0 animate-pulse rounded-lg border border-warm-gray bg-white"
          />
        ))}
      </div>
    </div>
  );
}
