import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactWithCompany } from "@/lib/services/contacts";
import { listTimelineEvents } from "@/lib/services/timeline";
import { listNotes } from "@/lib/services/notes";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimelineList } from "@/components/timeline-list";
import { NotesList } from "@/components/notes-list";
import { dateTime, relativeTime } from "@/lib/format";
import type { Email, Note, TimelineEvent } from "@/types";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContactWithCompany(id);
  if (!contact) notFound();

  const sb = getSupabaseAdmin();
  const [emailsRes, timelineEvents, notes] = await Promise.all([
    sb
      .from("emails")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    listTimelineEvents({ contact_id: id, limit: 50 }),
    listNotes("contact", id),
  ]);

  const emails = (emailsRes.data ?? []) as Email[];

  return (
    <div>
      <PageHeader
        title={contact.name}
        subtitle={[contact.title, contact.company?.name]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {contact.do_not_contact && (
              <Badge variant="danger">Do not contact</Badge>
            )}
            <Button variant="secondary" size="sm">
              Edit
            </Button>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <section className="rounded-lg border border-warm-gray bg-white p-5">
            <SectionHeader>Details</SectionHeader>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              <DetailRow label="Email" value={contact.email} />
              <DetailRow label="Phone" value={contact.phone} />
              <DetailRow label="LinkedIn" value={contact.linkedin_url} />
              <DetailRow label="Source" value={contact.source} />
              {contact.company && (
                <div className="col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
                    Company
                  </dt>
                  <dd className="mt-0.5">
                    <Link
                      href={`/companies/${contact.company.id}`}
                      className="text-[13px] text-forest hover:underline"
                    >
                      {contact.company.name}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <SectionHeader>Communications</SectionHeader>
            {emails.length === 0 ? (
              <div className="rounded-lg border border-warm-gray bg-white p-5 text-[13px] text-stone">
                No emails yet with this contact.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                {emails.map((email, idx) => (
                  <div
                    key={email.id}
                    className={`px-5 py-3 ${
                      idx === 0 ? "" : "border-t border-warm-gray"
                    }`}
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
                    <p className="mt-1.5 truncate text-[13px] font-medium text-ink">
                      {email.subject}
                    </p>
                    {email.body_text && (
                      <p className="mt-1 line-clamp-2 text-[12px] text-stone">
                        {email.body_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <SectionHeader>Notes</SectionHeader>
            <NotesList notes={notes as Note[]} />
          </section>
          <section>
            <SectionHeader>Timeline</SectionHeader>
            <TimelineList events={timelineEvents as TimelineEvent[]} />
          </section>
          <p className="text-[11px] text-stone">
            Last touch {relativeTime(contact.updated_at)}
          </p>
        </div>
      </div>
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
      <dd className="mt-0.5 break-all text-ink">{value ?? "—"}</dd>
    </div>
  );
}
