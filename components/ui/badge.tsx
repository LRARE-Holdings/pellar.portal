type BadgeVariant =
  | "default"
  | "forest"
  | "sage"
  | "stone"
  | "warning"
  | "danger";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-cream text-ink",
  forest: "bg-light-sage text-forest",
  sage: "bg-light-sage text-sage",
  stone: "bg-warm-gray text-stone",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
