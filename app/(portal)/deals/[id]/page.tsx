import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealWithRelations } from "@/lib/services/deals";
import { listTimelineEvents } from "@/lib/services/timeline";
import { listNotes } from "@/lib/services/notes";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, SectionHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  DraftEmailButton,
  OpenDraftButton,
} from "@/components/draft-email-button";
import { TimelineList } from "@/components/timeline-list";
import { NotesList } from "@/components/notes-list";
import { StageProgressBar } from "@/components/stage-progress-bar";
import {
  gbp,
  dateTime,
  relativeTime,
  dealStageVariant,
  dealStageLabel,
} from "@/lib/format";
import type { Briefing, Email, EmailDraft, Meeting, Note, TimelineEvent } from "@/types";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealWithRelations(id);
  if (!deal) notFound();

  const sb = getSupabaseAdmin();
  const [emailsRes, draftsRes, briefingsRes, meetingsRes, relatedDealsRes, notes, timeline] =
    await Promise.all([
      sb
        .from("emails")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      sb
        .from("email_drafts")
        .select("*")
        .eq("deal_id", id)
        .in("status", ["draft", "ready"])
        .order("created_at", { ascending: false }),
      sb
        .from("briefings")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("meetings")
        .select("*")
        .eq("deal_id", id)
        .order("scheduled_at", { ascending: true }),
      deal.company_id
        ? sb
            .from("deals")
            .select("id, title, stage, value")
            .eq("company_id", deal.company_id)
            .neq("id", id)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      listNotes("deal", id),
      listTimelineEvents({ deal_id: id, limit: 50 }),
    ]);

  const emails = (emailsRes.data ?? []) as Email[];
  const drafts = (draftsRes.data ?? []) as EmailDraft[];
  const briefings = (briefingsRes.data ?? []) as Briefing[];
  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const relatedDeals = (relatedDealsRes.data ?? []) as Array<{
    id: string;
    title: string;
    stage: string;
    value: number | null;
  }>;

  return (
    <div>
      <PageHeader
        title={deal.title}
        subtitle={
          deal.company
            ? `${deal.company.name}${deal.company.industry ? ` · ${deal.company.industry}` : ""}`
            : undefined
        }
        actions={
          <>
            <Badge variant={dealStageVariant(deal.stage)}>{deal.stage}</Badge>
            <DraftEmailButton
              dealId={deal.id}
              disabled={!deal.primary_contact?.email}
              disabledReason={
                deal.primary_contact
                  ? "No contact email"
                  : "No primary contact"
              }
            />
          </>
        }
      />

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Value" value={gbp(deal.value)} />
        <StatBlock label="Probability" value={`${deal.probability}%`} />
        <StatBlock label="Weighted" value={gbp(deal.weighted_value)} />
        <StatBlock
          label="Close date"
          value={deal.close_date ?? "—"}
          subtitle={
            deal.close_date ? relativeTime(deal.close_date) : undefined
          }
        />
      </div>

      {/* Stage progress bar */}
      <div className="mb-8 rounded-lg border border-warm-gray bg-white p-5">
        <StageProgressBar
          currentStage={deal.stage}
          stageChangedAt={deal.stage_changed_at}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          {drafts.length > 0 && (
            <section>
              <SectionHeader>Drafts ready</SectionHeader>
              <div className="overflow-hidden rounded-lg border border-forest/30 bg-light-sage">
                {drafts.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className={`px-5 py-4 ${
                      idx === 0 ? "" : "border-t border-forest/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-forest">
                        AI draft · {relativeTime(draft.created_at)}
                      </p>
                      <OpenDraftButton draftId={draft.id} />
                    </div>
                    <p className="mt-1.5 text-[14px] font-medium text-ink">
                      {draft.subject}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-stone">
                      {draft.body_text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeader>Email thread</SectionHeader>
            {emails.length === 0 ? (
              <EmptyState
                title="No emails yet"
                body="Click 'Draft email' to generate an AI draft for review."
              />
            ) : (
              <div className="space-y-3">
                {emails.map((email) => (
                  <article
                    key={email.id}
                    className="rounded-lg border border-warm-gray bg-white p-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          email.direction === "inbound" ? "warning" : "forest"
                        }
                      >
                        {email.direction}
                      </Badge>
                      <span className="text-[11px] text-stone">
                        {dateTime(email.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] font-semibold text-ink">
                      {email.subject}
                    </p>
                    <p className="mt-1 text-[11px] text-stone">
                      {email.direction === "inbound"
                        ? `from ${email.from_address}`
                        : `to ${email.to_address}`}
                    </p>
                    {email.body_text && (
                      <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                        {email.body_text}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {briefings.length > 0 && (
            <section>
              <SectionHeader>Briefings</SectionHeader>
              <div className="space-y-3">
                {briefings.map((b) => (
                  <Link
                    key={b.id}
                    href={`/briefings/${b.id}`}
                    className="block rounded-lg border border-warm-gray bg-white p-5 hover:border-forest/30"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                      {dateTime(b.created_at)}
                    </p>
                    <p className="mt-1 line-clamp-3 text-[13px] text-ink">
                      {b.summary}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {meetings.length > 0 && (
            <section>
              <SectionHeader>Meetings</SectionHeader>
              <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                {meetings.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`px-5 py-3 ${
                      idx === 0 ? "" : "border-t border-warm-gray"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-ink">
                        {m.title}
                      </p>
                      <Badge variant="sage">{m.status}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-stone">
                      {dateTime(m.scheduled_at)} · {m.duration_minutes}m
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-8">
          <section className="rounded-lg border border-warm-gray bg-white p-5">
            <SectionHeader>Details</SectionHeader>
            <dl className="space-y-3 text-[13px]">
              <DetailRow label="Offering" value={deal.offering?.name} />
              {deal.company && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Company
                  </dt>
                  <dd className="mt-0.5">
                    <Link
                      href={`/companies/${deal.company.id}`}
                      className="text-forest hover:underline"
                    >
                      {deal.company.name}
                    </Link>
                  </dd>
                </div>
              )}
              {deal.primary_contact && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Primary contact
                  </dt>
                  <dd className="mt-0.5">
                    <Link
                      href={`/contacts/${deal.primary_contact.id}`}
                      className="text-forest hover:underline"
                    >
                      {deal.primary_contact.name}
                    </Link>
                    {deal.primary_contact.title && (
                      <span className="text-stone">
                        {" "}
                        · {deal.primary_contact.title}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              <DetailRow
                label="Stage entered"
                value={relativeTime(deal.stage_changed_at)}
              />
              <DetailRow
                label="Source"
                value={deal.source.replace(/_/g, " ")}
              />
            </dl>
          </section>

          <section>
            <SectionHeader>Notes</SectionHeader>
            <NotesList notes={notes as Note[]} />
          </section>

          {relatedDeals.length > 0 && (
            <section>
              <SectionHeader>Related deals</SectionHeader>
              <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                {relatedDeals.map((rd, idx) => (
                  <Link
                    key={rd.id}
                    href={`/deals/${rd.id}`}
                    className={`flex items-center justify-between px-5 py-3 transition-colors hover:bg-cream ${
                      idx === 0 ? "" : "border-t border-warm-gray"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {rd.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone">
                        {rd.value ? gbp(rd.value) : "No value"}
                      </p>
                    </div>
                    <Badge variant={dealStageVariant(rd.stage)}>
                      {dealStageLabel(rd.stage)}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeader>Timeline</SectionHeader>
            <TimelineList events={timeline as TimelineEvent[]} />
          </section>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-warm-gray bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
        {label}
      </p>
      <p className="mt-1 text-[24px] font-light leading-tight text-ink">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] text-stone">{subtitle}</p>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink">{value ?? "—"}</dd>
    </div>
  );
}
