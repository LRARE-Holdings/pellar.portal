import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";
import type { InboxItemKind, InboxItemWithRelations } from "@/types";

interface DashboardInboxWidgetProps {
  items: InboxItemWithRelations[];
}

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

function inboxItemHref(item: InboxItemWithRelations): string {
  switch (item.kind) {
    case "draft_ready":
      if (item.deal_id) return `/deals/${item.deal_id}?draft=${item.source_id}`;
      if (item.contact_id)
        return `/contacts/${item.contact_id}?draft=${item.source_id}`;
      if (item.company_id)
        return `/companies/${item.company_id}?draft=${item.source_id}`;
      return `/inbox`;
    case "unanswered_inbound":
      if (item.deal_id)
        return `/deals/${item.deal_id}?reply=${item.source_id}`;
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

export function DashboardInboxWidget({ items }: DashboardInboxWidgetProps) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-stone">Inbox zero.</p>
    );
  }

  const displayed = items.slice(0, 8);

  return (
    <div>
      <div className="space-y-0">
        {displayed.map((item, idx) => (
          <Link
            key={item.id}
            href={inboxItemHref(item)}
            className={`flex items-start gap-3 px-1 py-3 transition-colors hover:bg-cream ${
              idx > 0 ? "border-t border-warm-gray" : ""
            }`}
          >
            <Badge variant={KIND_VARIANTS[item.kind]}>
              {KIND_LABELS[item.kind]}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">
                {item.title}
              </p>
              {item.company && (
                <p className="mt-0.5 truncate text-[11px] text-stone">
                  {item.company.name}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[11px] text-stone">
              {relativeTime(item.sort_at)}
            </span>
          </Link>
        ))}
      </div>
      <Link
        href="/inbox"
        className="mt-3 block text-right text-[12px] font-medium text-forest hover:underline"
      >
        View all
      </Link>
    </div>
  );
}
