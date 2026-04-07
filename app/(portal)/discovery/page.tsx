import Link from "next/link";
import { listCandidates } from "@/lib/services/discovery-candidates";
import { PageHeader, SectionHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { DiscoveryReviewActions } from "@/components/discovery-review-actions";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const [pending, accepted, rejected] = await Promise.all([
    listCandidates({ status: "pending_review", limit: 100 }),
    listCandidates({ status: "accepted", limit: 20 }),
    listCandidates({ status: "rejected", limit: 20 }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Discovery review"
        subtitle={`${pending.length} pending review · ${accepted.length} accepted · ${rejected.length} rejected`}
      />

      <p className="mb-6 max-w-2xl rounded-lg border border-warm-gray bg-white px-5 py-4 text-[12px] leading-relaxed text-stone">
        Discovery surfaces a small weekly batch of candidate companies for
        review. Nothing is auto-created and nothing is auto-emailed. Accept to
        promote to a real company + contact + deal in the lead stage. Reject
        to dismiss.
      </p>

      {pending.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          body="The next discovery batch runs Mondays at 06:00 UTC."
        />
      ) : (
        <section className="mb-12">
          <SectionHeader>Pending review</SectionHeader>
          <div className="space-y-3">
            {pending.map((c) => (
              <article
                key={c.id}
                className="rounded-lg border border-warm-gray bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-medium text-ink">
                        {c.company_name}
                      </h3>
                      {c.fit_score != null && (
                        <Badge
                          variant={
                            c.fit_score >= 70
                              ? "forest"
                              : c.fit_score >= 50
                                ? "sage"
                                : "stone"
                          }
                        >
                          Fit {c.fit_score}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-stone">
                      {[c.industry, c.location].filter(Boolean).join(" · ")}
                    </p>
                    {c.frustration_hypothesis && (
                      <p className="mt-2 text-[13px] leading-relaxed text-ink">
                        {c.frustration_hypothesis}
                      </p>
                    )}
                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] text-stone sm:grid-cols-3">
                      {c.contact_name && (
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.05em]">
                            Contact
                          </dt>
                          <dd className="text-ink">
                            {c.contact_name}
                            {c.contact_title ? `, ${c.contact_title}` : ""}
                          </dd>
                        </div>
                      )}
                      {c.contact_email && (
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.05em]">
                            Email
                          </dt>
                          <dd className="break-all text-ink">
                            {c.contact_email}
                          </dd>
                        </div>
                      )}
                      {c.estimated_employees && (
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.05em]">
                            Size
                          </dt>
                          <dd className="text-ink">
                            ~{c.estimated_employees} people
                          </dd>
                        </div>
                      )}
                      {c.google_rating && (
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.05em]">
                            Google
                          </dt>
                          <dd className="text-ink">
                            {c.google_rating}★ ({c.google_reviews ?? 0})
                          </dd>
                        </div>
                      )}
                      {c.website && (
                        <div className="col-span-2">
                          <dt className="text-[10px] uppercase tracking-[0.05em]">
                            Website
                          </dt>
                          <dd>
                            <a
                              href={
                                c.website.startsWith("http")
                                  ? c.website
                                  : `https://${c.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-forest hover:underline"
                            >
                              {c.domain ?? c.website}
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <DiscoveryReviewActions id={c.id} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {(accepted.length > 0 || rejected.length > 0) && (
        <section>
          <SectionHeader>Recent decisions</SectionHeader>
          <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
            {[...accepted, ...rejected]
              .sort(
                (a, b) =>
                  new Date(b.reviewed_at ?? b.created_at).getTime() -
                  new Date(a.reviewed_at ?? a.created_at).getTime(),
              )
              .map((c, idx) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-4 px-5 py-3 ${
                    idx === 0 ? "" : "border-t border-warm-gray"
                  }`}
                >
                  <div className="min-w-0">
                    {c.promoted_company_id ? (
                      <Link
                        href={`/companies/${c.promoted_company_id}`}
                        className="truncate text-[13px] font-medium text-ink hover:text-forest"
                      >
                        {c.company_name}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-medium text-ink">
                        {c.company_name}
                      </span>
                    )}
                    <p className="truncate text-[11px] text-stone">
                      {[c.industry, c.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right text-[11px]">
                    <Badge variant={c.status === "accepted" ? "forest" : "stone"}>
                      {c.status}
                    </Badge>
                    <p className="mt-1 text-stone">
                      {relativeTime(c.reviewed_at ?? c.created_at)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
