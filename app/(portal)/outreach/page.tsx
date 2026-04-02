import { createClient } from "@/lib/supabase/server";
import { EmailFeed } from "@/components/email-feed";
import type { EmailStats, Email } from "@/types";

export default async function OutreachPage() {
  const supabase = await createClient();

  const [statsResult, emailsResult] = await Promise.all([
    supabase.from("email_stats").select("*").single(),
    supabase
      .from("emails")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const stats = (statsResult.data || {}) as EmailStats;
  const emails = (emailsResult.data || []) as Email[];

  return (
    <div>
      <h1 className="text-[28px] font-normal text-ink">Outreach</h1>

      <div className="mt-6 grid grid-cols-5 gap-4">
        <StatCard label="Sent" value={stats.sent || 0} />
        <StatCard label="Delivered" value={stats.delivered || 0} />
        <StatCard label="Opened" value={stats.opened || 0} />
        <StatCard label="Received" value={stats.received || 0} />
        <StatCard
          label="Response Rate"
          value={`${stats.response_rate || 0}%`}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
          Email Feed
        </h2>
        <div className="mt-3">
          <EmailFeed emails={emails} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-warm-gray bg-white p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-light text-ink">{value}</p>
    </div>
  );
}
