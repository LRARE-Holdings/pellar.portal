/**
 * Display formatters used across the new CRM UI.
 *
 * Brand rules:
 *  - Currency: "GBP 12,500" with hard-space (no £ glyph in body copy unless
 *    explicitly approved). For numeric headers we use the £ glyph since
 *    that's the convention in deals UI.
 *  - Dates: short, sentence-case, no slashes (e.g. "12 Apr").
 *  - Times: 24-hour, no seconds.
 */

export function gbp(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "£0";
  return `£${value.toLocaleString("en-GB")}`;
}

export function gbpCompact(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    return `£${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (value >= 1_000) {
    return `£${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `£${value}`;
}

export function shortDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function dateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}

export function relativeTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  const abs = Math.abs(diffMin);
  if (abs < 1) return "just now";
  if (abs < 60) {
    return diffMin < 0 ? `${abs}m ago` : `in ${abs}m`;
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours < 0 ? `${Math.abs(diffHours)}h ago` : `in ${diffHours}h`;
  }
  if (Math.abs(diffDays) < 14) {
    return diffDays < 0 ? `${Math.abs(diffDays)}d ago` : `in ${diffDays}d`;
  }
  return shortDate(d);
}

export function dealStageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STAGE_COLOR: Record<string, string> = {
  lead: "stone",
  qualified: "sage",
  discovery: "sage",
  proposal: "forest",
  negotiation: "forest",
  won: "forest",
  lost: "danger",
};

export function dealStageVariant(
  stage: string,
):
  | "default"
  | "forest"
  | "sage"
  | "stone"
  | "warning"
  | "danger" {
  return (STAGE_COLOR[stage] ?? "default") as
    | "default"
    | "forest"
    | "sage"
    | "stone"
    | "warning"
    | "danger";
}
