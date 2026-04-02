import type { EmailDeliveryHealth } from "@/types";

interface DeliveryHealthPanelProps {
  health: EmailDeliveryHealth;
}

export function DeliveryHealthPanel({ health }: DeliveryHealthPanelProps) {
  return (
    <div className="space-y-3">
      <HealthBar
        label="Delivery Rate"
        value={health.delivery_rate}
        colour="bg-forest"
      />
      <HealthBar
        label="Open Rate"
        value={health.open_rate}
        colour="bg-sage"
      />
      <HealthBar
        label="Bounce Rate"
        value={health.bounce_rate}
        colour="bg-red-400"
        inverted
      />
      <div className="mt-2 flex gap-4 text-[11px] text-stone">
        <span>Sent: {health.total_sent}</span>
        <span>Delivered: {health.delivered}</span>
        <span>Opened: {health.opened}</span>
        <span>Bounced: {health.bounced}</span>
      </div>
    </div>
  );
}

function HealthBar({
  label,
  value,
  colour,
  inverted,
}: {
  label: string;
  value: number;
  colour: string;
  inverted?: boolean;
}) {
  const isGood = inverted ? value < 5 : value > 80;
  const isWarning = inverted ? value >= 5 && value < 15 : value >= 50 && value <= 80;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-stone">{label}</span>
        <span
          className={`text-[11px] font-semibold ${
            isGood ? "text-forest" : isWarning ? "text-amber-600" : "text-red-600"
          }`}
        >
          {value}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-warm-gray">
        <div
          className={`h-1.5 rounded-full ${colour}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
