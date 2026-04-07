import Link from "next/link";
import { listInboxItems } from "@/lib/services/inbox";
import { PageHeader, SectionHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { gbpCompact, relativeTime, dealStageVariant } from "@/lib/format";
import type { InboxItemKind, InboxItemWithRelations } from "@/types";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<InboxItemKind, string> = {
  draft_ready: "Draft ready",
  unanswered_inbound: "Reply needed",
  task_overdue: "Task overdue",
  meeting_soon: "Meeting soon",
  deal_stale: "Stale deal",
};

const KIND_VARIANTS: Record<
  InboxItemKind,
  "forest" | "sage" | "warning" | "danger" | "stone"
> = {
  draft_ready: "forest",
  unanswered_inbound: "warning",
  task_overdue: "danger",
  meeting_soon: "sage",
  deal_stale: "stone",
};

export default async function InboxPage() {
  const items = await listInboxItems(100);

  const grouped = groupByKind(items);
  const totalCount = items.length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Inbox"
        subtitle={
          totalCount === 0
            ? "Nothing demanding your attention. Good time to write."
            : `${totalCount} item${totalCount === 1 ? "" : "s"} need attention`
        }
      />

      {totalCount === 0 ? (
        <EmptyState
          title="Inbox zero"
          body="When drafts are ready, replies need writing, tasks come due, or meetings are imminent, they show up here. Press cmd+K to add something."
        />
      ) : (
        <div className="space-y-8">
          {(
            [
              "draft_ready",
              "unanswered_inbound",
              "task_overdue",
              "meeting_soon",
              "deal_stale",
            ] as InboxItemKind[]
          )
            .filter((kind) => (grouped[kind]?.length ?? 0) > 0)
            .map((kind) => (
              <section key={kind}>
                <SectionHeader>
                  {KIND_LABELS[kind]}
                  <span className="ml-2 text-[11px] font-normal normal-case text-stone">
                    {grouped[kind]?.length}
                  </span>
                </SectionHeader>
                <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
                  {grouped[kind]?.map((item, idx) => (
                    <InboxRow
                      key={item.id}
                      item={item}
                      isFirst={idx === 0}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

function groupByKind(
  items: InboxItemWithRelations[],
): Record<InboxItemKind, InboxItemWithRelations[]> {
  const out: Record<InboxItemKind, InboxItemWithRelations[]> = {
    draft_ready: [],
    unanswered_inbound: [],
    task_overdue: [],
    meeting_soon: [],
    deal_stale: [],
  };
  for (const item of items) {
    out[item.kind].push(item);
  }
  return out;
}

function InboxRow({
  item,
  isFirst,
}: {
  item: InboxItemWithRelations;
  isFirst: boolean;
}) {
  const href = inboxItemHref(item);
  const meta = item.metadata as Record<string, unknown>;

  return (
    <Link
      href={href}
      className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-cream ${
        isFirst ? "" : "border-t border-warm-gray"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={KIND_VARIANTS[item.kind]}>
            {KIND_LABELS[item.kind]}
          </Badge>
          {item.deal && (
            <Badge variant={dealStageVariant(item.deal.stage)}>
              {item.deal.stage}
            </Badge>
          )}
          {item.kind === "deal_stale" && item.deal?.value ? (
            <span className="text-[11px] font-medium text-stone">
              {gbpCompact(item.deal.value)}
            </span>
          ) : null}
          {item.kind === "unanswered_inbound" && meta.intent ? (
            <span className="text-[11px] font-medium uppercase tracking-[0.03em] text-stone">
              {String(meta.intent)}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 truncate text-[14px] font-medium text-ink">
          {item.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-stone">
          {item.company && (
            <span className="truncate">{item.company.name}</span>
          )}
          {item.contact && item.company && <span>·</span>}
          {item.contact && (
            <span className="truncate">{item.contact.name}</span>
          )}
          {item.subtitle && (
            <>
              <span>·</span>
              <span className="truncate">{item.subtitle}</span>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right text-[12px] text-stone">
        {relativeTime(item.sort_at)}
      </div>
    </Link>
  );
}

function inboxItemHref(item: InboxItemWithRelations): string {
  switch (item.kind) {
    case "draft_ready":
      // The draft drawer mounts at the deal route via ?draft=<id> param
      if (item.deal_id) return `/deals/${item.deal_id}?draft=${item.source_id}`;
      if (item.contact_id)
        return `/contacts/${item.contact_id}?draft=${item.source_id}`;
      if (item.company_id)
        return `/companies/${item.company_id}?draft=${item.source_id}`;
      return `/inbox`;
    case "unanswered_inbound":
      if (item.deal_id) return `/deals/${item.deal_id}?reply=${item.source_id}`;
      if (item.contact_id)
        return `/contacts/${item.contact_id}?reply=${item.source_id}`;
      return `/inbox`;
    case "task_overdue":
      return `/tasks?id=${item.source_id}`;
    case "meeting_soon":
      return `/calendar?meeting=${item.source_id}`;
    case "deal_stale":
      return `/deals/${item.source_id}`;
  }
}
