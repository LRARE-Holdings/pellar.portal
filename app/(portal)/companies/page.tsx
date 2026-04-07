import Link from "next/link";
import { listCompanies } from "@/lib/services/companies";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { gbpCompact, relativeTime } from "@/lib/format";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface SearchParams {
  search?: string;
  industry?: string;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const companies = await listCompanies({
    search: params.search,
    industry: params.industry,
    limit: 200,
  });

  // Aggregate stats from deals + engagement in one round trip
  const sb = getSupabaseAdmin();
  const ids = companies.map((c) => c.id);
  const [dealsRes, engagementRes] = await Promise.all([
    ids.length > 0
      ? sb
          .from("deals")
          .select("company_id, value, stage")
          .in("company_id", ids)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
    ids.length > 0
      ? sb.from("company_engagement").select("*").in("company_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  type StatRow = { value: number; pipeline: number; activeDeals: number };
  const stats = new Map<string, StatRow>();
  for (const id of ids) stats.set(id, { value: 0, pipeline: 0, activeDeals: 0 });
  for (const d of (dealsRes.data ?? []) as Array<{
    company_id: string;
    value: number | null;
    stage: string;
  }>) {
    const s = stats.get(d.company_id);
    if (!s) continue;
    if (!["won", "lost"].includes(d.stage)) {
      s.activeDeals++;
      s.pipeline += d.value ?? 0;
    }
  }

  const engagement = new Map<
    string,
    { score: number; lastTouch: string | null }
  >();
  for (const e of (engagementRes.data ?? []) as Array<{
    company_id: string;
    engagement_score: number;
    last_touch_at: string | null;
  }>) {
    engagement.set(e.company_id, {
      score: e.engagement_score,
      lastTouch: e.last_touch_at,
    });
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} ${
          companies.length === 1 ? "company" : "companies"
        }`}
      />

      <form className="mb-6">
        <input
          type="search"
          name="search"
          placeholder="Search by name, domain or industry"
          defaultValue={params.search ?? ""}
          className="w-full max-w-md rounded-lg border border-warm-gray bg-white px-4 py-2 text-[13px] text-ink placeholder:text-stone focus:border-forest focus:outline-none"
        />
      </form>

      {companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          body="Companies are created automatically when leads come in via the contact form, and manually via cmd+K."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-warm-gray bg-cream text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
              <tr>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Industry</th>
                <th className="px-5 py-3">Active deals</th>
                <th className="px-5 py-3 text-right">Pipeline</th>
                <th className="px-5 py-3">Engagement</th>
                <th className="px-5 py-3">Last touch</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const stat = stats.get(c.id);
                const eng = engagement.get(c.id);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-warm-gray last:border-0 hover:bg-cream"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/companies/${c.id}`}
                        className="font-medium text-ink hover:text-forest"
                      >
                        {c.name}
                      </Link>
                      {c.location ? (
                        <p className="mt-0.5 text-[11px] text-stone">
                          {c.location}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-stone">
                      {c.industry ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {stat?.activeDeals ? (
                        <Badge variant="forest">{stat.activeDeals}</Badge>
                      ) : (
                        <span className="text-stone">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-ink">
                      {gbpCompact(stat?.pipeline ?? 0)}
                    </td>
                    <td className="px-5 py-3">
                      {eng ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded bg-warm-gray">
                            <div
                              className="h-full bg-forest"
                              style={{ width: `${Math.min(100, eng.score)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-stone">
                            {eng.score}
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-stone">
                      {relativeTime(eng?.lastTouch ?? c.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
