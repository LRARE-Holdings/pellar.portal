import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyWithRelations } from "@/lib/services/companies";
import { listTimelineEvents } from "@/lib/services/timeline";
import { listNotes } from "@/lib/services/notes";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, SectionHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimelineList } from "@/components/timeline-list";
import { NotesList } from "@/components/notes-list";
import { gbp, gbpCompact, dateTime, relativeTime, dealStageVariant } from "@/lib/format";
import type {
  Contact,
  Deal,
  DealStage,
  Email,
  Note,
  TimelineEvent,
} from "@/types";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompanyWithRelations(id);
  if (!company) notFound();

  const sb = getSupabaseAdmin();
  const [
    contactsRes,
    dealsRes,
    emailsRes,
    timelineEvents,
    notes,
  ] = await Promise.all([
    sb
      .from("contacts")
      .select("*")
      .eq("company_id", id)
      .is("archived_at", null)
      .order("is_primary", { ascending: false })
      .order("name"),
    sb
      .from("deals")
      .select("*")
      .eq("company_id", id)
      .is("archived_at", null)
      .order("stage", { ascending: true })
      .order("updated_at", { ascending: false }),
    sb
      .from("emails")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    listTimelineEvents({ company_id: id, limit: 50 }),
    listNotes("company", id),
  ]);

  const contacts = (contactsRes.data ?? []) as Contact[];
  const deals = (dealsRes.data ?? []) as Deal[];
  const emails = (emailsRes.data ?? []) as Email[];

  const activeDeals = deals.filter((d) => !["won", "lost"].includes(d.stage));
  const totalPipeline = activeDeals.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={[company.industry, company.location]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {company.website && (
              <a
                href={
                  company.website.startsWith("http")
                    ? company.website
                    : `https://${company.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-stone hover:text-forest"
              >
                {company.domain ?? company.website}
              </a>
            )}
            <Button variant="secondary" size="sm">
              Edit
            </Button>
          </>
        }
      />

      {/* Top stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock
          label="Pipeline"
          value={gbpCompact(totalPipeline)}
          subtitle={`${activeDeals.length} active`}
        />
        <StatBlock
          label="Engagement"
          value={`${company.engagement?.engagement_score ?? 0}`}
          subtitle="touch + recency"
        />
        <StatBlock
          label="Contacts"
          value={`${contacts.length}`}
          subtitle={contacts.length === 1 ? "person" : "people"}
        />
        <StatBlock
          label="Last touch"
          value={relativeTime(company.engagement?.last_touch_at ?? company.updated_at)}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Left column: Deals + Contacts + Emails */}
        <div className="space-y-8">
          <section>
            <SectionHeader
              action={
                <Link
                  href={`/deals/new?company_id=${id}`}
                  className="text-[11px] font-medium uppercase tracking-[0.05em] text-forest hover:underline"
                >
                  + New deal
                </Link>
              }
            >
              Deals
            </SectionHeader>
            {deals.length === 0 ? (
              <EmptyState
                title="No deals yet"
                body="Create a deal to start tracking the opportunity."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                {deals.map((deal, idx) => (
                  <DealRow key={deal.id} deal={deal} isFirst={idx === 0} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              action={
                <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-stone">
                  cmd+K → contact
                </span>
              }
            >
              Contacts
            </SectionHeader>
            {contacts.length === 0 ? (
              <EmptyState
                title="No contacts yet"
                body="Add a contact via cmd+K to start tracking the relationship."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                {contacts.map((c, idx) => (
                  <ContactRow key={c.id} contact={c} isFirst={idx === 0} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader>Recent emails</SectionHeader>
            {emails.length === 0 ? (
              <EmptyState
                title="No emails yet"
                body="Once you draft and send an email to a contact at this company, the thread shows up here."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                {emails.map((email, idx) => (
                  <EmailRow key={email.id} email={email} isFirst={idx === 0} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column: Details + Notes + Timeline */}
        <div className="space-y-8">
          <section className="rounded-lg border border-warm-gray bg-white p-5">
            <SectionHeader>Details</SectionHeader>
            <dl className="space-y-3 text-[13px]">
              <DetailRow label="Phone" value={company.phone} />
              <DetailRow
                label="Website"
                value={company.domain ?? company.website}
                href={
                  company.website
                    ? company.website.startsWith("http")
                      ? company.website
                      : `https://${company.website}`
                    : null
                }
              />
              <DetailRow label="Industry" value={company.industry} />
              <DetailRow label="Location" value={company.location} />
              <DetailRow
                label="Employees"
                value={
                  company.estimated_employees
                    ? `~${company.estimated_employees}`
                    : null
                }
              />
              <DetailRow label="Revenue" value={company.estimated_revenue} />
              <DetailRow
                label="Age"
                value={
                  company.company_age_years
                    ? `${company.company_age_years} years`
                    : null
                }
              />
              <DetailRow
                label="Companies House"
                value={company.company_number}
                href={
                  company.company_number
                    ? `https://find-and-update.company-information.service.gov.uk/company/${company.company_number}`
                    : null
                }
              />
              <DetailRow
                label="LinkedIn"
                value={company.linkedin_url}
                href={company.linkedin_url}
              />
              <DetailRow
                label="Google rating"
                value={
                  company.google_rating
                    ? `${company.google_rating}★ (${company.google_reviews ?? 0})`
                    : null
                }
              />
            </dl>
          </section>

          <section>
            <SectionHeader>Notes</SectionHeader>
            <NotesList notes={notes as Note[]} />
          </section>

          <section>
            <SectionHeader>Timeline</SectionHeader>
            <TimelineList events={timelineEvents as TimelineEvent[]} />
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
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string | null;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
        {label}
      </dt>
      <dd className="mt-0.5 break-all text-ink">
        {value && href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-forest hover:underline"
          >
            {value}
          </a>
        ) : (
          (value ?? "—")
        )}
      </dd>
    </div>
  );
}

function DealRow({ deal, isFirst }: { deal: Deal; isFirst: boolean }) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className={`flex items-start justify-between gap-4 px-5 py-4 hover:bg-cream ${
        isFirst ? "" : "border-t border-warm-gray"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={dealStageVariant(deal.stage as DealStage)}>
            {deal.stage}
          </Badge>
          <span className="text-[12px] text-stone">
            {relativeTime(deal.last_activity_at ?? deal.updated_at)}
          </span>
        </div>
        <p className="mt-1.5 truncate text-[14px] font-medium text-ink">
          {deal.title}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-medium text-ink">{gbp(deal.value)}</p>
        {deal.close_date && (
          <p className="text-[11px] text-stone">close {deal.close_date}</p>
        )}
      </div>
    </Link>
  );
}

function ContactRow({
  contact,
  isFirst,
}: {
  contact: Contact;
  isFirst: boolean;
}) {
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className={`flex items-center justify-between gap-4 px-5 py-3 hover:bg-cream ${
        isFirst ? "" : "border-t border-warm-gray"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-ink">
          {contact.name}
          {contact.is_primary && (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-forest">
              Primary
            </span>
          )}
        </p>
        <p className="truncate text-[12px] text-stone">
          {contact.title ?? "—"}
          {contact.email ? ` · ${contact.email}` : ""}
          {contact.phone ? ` · ${contact.phone}` : ""}
        </p>
      </div>
      {contact.do_not_contact && (
        <Badge variant="danger">Do not contact</Badge>
      )}
    </Link>
  );
}

function EmailRow({ email, isFirst }: { email: Email; isFirst: boolean }) {
  return (
    <div
      className={`px-5 py-3 ${isFirst ? "" : "border-t border-warm-gray"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant={email.direction === "inbound" ? "warning" : "forest"}
        >
          {email.direction}
        </Badge>
        <span className="text-[11px] text-stone">
          {dateTime(email.created_at)}
        </span>
      </div>
      <p className="mt-1.5 truncate text-[13px] font-medium text-ink">
        {email.subject}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-stone">
        {email.direction === "inbound"
          ? `from ${email.from_address}`
          : `to ${email.to_address}`}
      </p>
    </div>
  );
}
