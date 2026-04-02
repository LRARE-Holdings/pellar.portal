interface ScoreDotProps {
  score: number;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "bg-forest";
  if (score >= 40) return "bg-sage";
  return "bg-stone";
}

export function ScoreDot({ score, className = "" }: ScoreDotProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-block h-2 w-2 rounded-full ${getScoreColor(score)}`}
      />
      <span className="text-xs font-medium text-ink">{score}</span>
    </span>
  );
}
