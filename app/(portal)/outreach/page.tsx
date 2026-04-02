import { createClient } from "@/lib/supabase/server";
import { EmailFeed } from "@/components/email-feed";
import { StatCard } from "@/components/stat-card";
import { DeliveryHealthPanel } from "@/components/delivery-health-panel";
import type { EmailStats, EmailDeliveryHealth, Email } from "@/types";

export default async function OutreachPage() {
  const supabase = await createClient();

  const [statsResult, healthResult, emailsResult] = await Promise.all([
    supabase.from("email_stats").select("*").single(),
    supabase.from("email_delivery_health").select("*").single(),
    supabase
      .from("emails")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const stats = (statsResult.data || {}) as EmailStats;
  const health = (healthResult.data || {}) as EmailDeliveryHealth;
  const emails = (emailsResult.data || []) as Email[];

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Outreach</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left column: stats + delivery health */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Sent" value={stats.sent || 0} />
            <StatCard label="Delivered" value={stats.delivered || 0} />
            <StatCard label="Opened" value={stats.opened || 0} />
            <StatCard label="Received" value={stats.received || 0} />
          </div>
          <StatCard
            label="Response Rate"
            value={`${stats.response_rate || 0}%`}
          />

          <div className="rounded-lg border border-warm-gray bg-white p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
              Delivery Health
            </h2>
            <div className="mt-3">
              <DeliveryHealthPanel health={health} />
            </div>
          </div>
        </div>

        {/* Right column: email feed */}
        <div className="xl:col-span-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
            Email Feed
          </h2>
          <div className="mt-3">
            <EmailFeed emails={emails} />
          </div>
        </div>
      </div>
    </div>
  );
}
