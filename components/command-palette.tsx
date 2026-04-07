"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  companies: Array<{ id: string; name: string; industry: string | null }>;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    company: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;
  deals: Array<{
    id: string;
    title: string;
    stage: string;
    company: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;
}

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  onSelect: () => void;
}

/**
 * Cmd+K command palette. Search across companies / contacts / deals,
 * plus quick-add actions and direct navigation.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState<
    null | "company" | "contact" | "deal" | "task" | "note"
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K toggle. Open and close are handled here so we can reset state at
  // the same time without a downstream effect.
  useEffect(() => {
    function reset() {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
      setShowQuickAdd(null);
    }
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((wasOpen) => {
          if (!wasOpen) reset();
          return !wasOpen;
        });
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search. We don't clear results here when the query is empty —
  // we let the items list render the quick-add actions instead.
  useEffect(() => {
    if (!open || !query.trim()) return;
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SearchResult | null) => {
          if (data) setResults(data);
        });
    }, 150);
    return () => clearTimeout(handle);
  }, [query, open]);

  // Build the flat item list for keyboard nav
  const items = buildItems(query, results, router, setShowQuickAdd, () =>
    setOpen(false),
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[activeIndex]?.onSelect();
      }
    },
    [items, activeIndex],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />
      <div className="absolute left-1/2 top-[15vh] w-[92%] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-warm-gray bg-white shadow-2xl">
        {showQuickAdd ? (
          <QuickAddForm
            kind={showQuickAdd}
            onCancel={() => setShowQuickAdd(null)}
            onCreated={(href) => {
              setOpen(false);
              if (href) router.push(href);
              router.refresh();
            }}
          />
        ) : (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search or run a command…"
              className="w-full border-b border-warm-gray bg-white px-5 py-4 text-[15px] text-ink placeholder:text-stone focus:outline-none"
            />
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {items.length === 0 ? (
                <p className="px-5 py-4 text-[12px] text-stone">
                  Type to search.
                </p>
              ) : (
                <ItemList items={items} activeIndex={activeIndex} />
              )}
            </div>
            <div className="flex items-center justify-between border-t border-warm-gray bg-cream px-5 py-2 text-[10px] uppercase tracking-[0.05em] text-stone">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function buildItems(
  query: string,
  results: SearchResult | null,
  router: ReturnType<typeof useRouter>,
  showQuickAdd: (kind: "company" | "contact" | "deal" | "task" | "note") => void,
  close: () => void,
): PaletteItem[] {
  const items: PaletteItem[] = [];

  // Quick-add actions (always visible)
  items.push(
    {
      id: "qa-company",
      label: "New company",
      hint: "Add an organisation",
      group: "Quick add",
      onSelect: () => showQuickAdd("company"),
    },
    {
      id: "qa-contact",
      label: "New contact",
      hint: "Add a person",
      group: "Quick add",
      onSelect: () => showQuickAdd("contact"),
    },
    {
      id: "qa-deal",
      label: "New deal",
      hint: "Open an opportunity",
      group: "Quick add",
      onSelect: () => showQuickAdd("deal"),
    },
    {
      id: "qa-task",
      label: "New task",
      hint: "Add a follow-up",
      group: "Quick add",
      onSelect: () => showQuickAdd("task"),
    },
    {
      id: "qa-note",
      label: "New note",
      hint: "Capture context",
      group: "Quick add",
      onSelect: () => showQuickAdd("note"),
    },
  );

  // Navigation
  const nav = [
    { href: "/inbox", label: "Inbox" },
    { href: "/companies", label: "Companies" },
    { href: "/contacts", label: "Contacts" },
    { href: "/deals", label: "Deals" },
    { href: "/tasks", label: "Tasks" },
    { href: "/forecast", label: "Forecast" },
    { href: "/calendar", label: "Calendar" },
    { href: "/briefings", label: "Briefings" },
    { href: "/discovery", label: "Discovery" },
    { href: "/dashboard", label: "Dashboard" },
  ];
  for (const n of nav) {
    if (!query || n.label.toLowerCase().includes(query.toLowerCase())) {
      items.push({
        id: `nav-${n.href}`,
        label: `Go to ${n.label}`,
        group: "Navigate",
        onSelect: () => {
          router.push(n.href);
          close();
        },
      });
    }
  }

  // Search results
  if (results) {
    for (const c of results.companies) {
      items.push({
        id: `co-${c.id}`,
        label: c.name,
        hint: c.industry ?? "Company",
        group: "Companies",
        onSelect: () => {
          router.push(`/companies/${c.id}`);
          close();
        },
      });
    }
    for (const c of results.contacts) {
      const company = Array.isArray(c.company) ? c.company[0] : c.company;
      items.push({
        id: `ct-${c.id}`,
        label: c.name,
        hint: [c.email, company?.name].filter(Boolean).join(" · "),
        group: "Contacts",
        onSelect: () => {
          router.push(`/contacts/${c.id}`);
          close();
        },
      });
    }
    for (const d of results.deals) {
      const company = Array.isArray(d.company) ? d.company[0] : d.company;
      items.push({
        id: `dl-${d.id}`,
        label: d.title,
        hint: [d.stage, company?.name].filter(Boolean).join(" · "),
        group: "Deals",
        onSelect: () => {
          router.push(`/deals/${d.id}`);
          close();
        },
      });
    }
  }

  return items;
}

function ItemList({
  items,
  activeIndex,
}: {
  items: PaletteItem[];
  activeIndex: number;
}) {
  // Group consecutive items with the same `group`
  const groups: { name: string; items: { item: PaletteItem; index: number }[] }[] = [];
  let last: string | null = null;
  items.forEach((item, index) => {
    if (item.group !== last) {
      groups.push({ name: item.group, items: [] });
      last = item.group;
    }
    groups[groups.length - 1].items.push({ item, index });
  });

  return (
    <>
      {groups.map((g, gi) => (
        <div key={`${g.name}-${gi}`}>
          <p className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.05em] text-stone">
            {g.name}
          </p>
          {g.items.map(({ item, index }) => (
            <button
              key={item.id}
              onClick={item.onSelect}
              onMouseEnter={() => {
                /* hover doesn't update active index — keep keyboard sticky */
              }}
              className={`flex w-full items-center justify-between px-5 py-2 text-left text-[13px] ${
                index === activeIndex
                  ? "bg-cream text-ink"
                  : "text-ink hover:bg-cream"
              }`}
            >
              <span className="truncate font-medium">{item.label}</span>
              {item.hint && (
                <span className="ml-3 shrink-0 text-[11px] text-stone">
                  {item.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}

function QuickAddForm({
  kind,
  onCancel,
  onCreated,
}: {
  kind: "company" | "contact" | "deal" | "task" | "note";
  onCancel: () => void;
  onCreated: (href?: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = FIELDS[kind];
  const title = TITLES[kind];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${ENDPOINTS[kind]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      const json = await res.json().catch(() => ({}));
      const href = HREF[kind](json);
      onCreated(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="border-b border-warm-gray px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
          {title}
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
              {f.label}
            </label>
            {f.type === "textarea" ? (
              <textarea
                value={form[f.name] ?? ""}
                onChange={(e) =>
                  setForm({ ...form, [f.name]: e.target.value })
                }
                placeholder={f.placeholder}
                rows={3}
                required={f.required}
                className="mt-1 w-full rounded-md border border-warm-gray bg-white px-3 py-2 text-[13px] text-ink focus:border-forest focus:outline-none"
              />
            ) : (
              <input
                value={form[f.name] ?? ""}
                onChange={(e) =>
                  setForm({ ...form, [f.name]: e.target.value })
                }
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                required={f.required}
                autoFocus={f === fields[0]}
                className="mt-1 w-full rounded-md border border-warm-gray bg-white px-3 py-2 text-[13px] text-ink focus:border-forest focus:outline-none"
              />
            )}
          </div>
        ))}
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-warm-gray bg-cream px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-stone hover:text-ink"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-forest px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}

const TITLES: Record<string, string> = {
  company: "New company",
  contact: "New contact",
  deal: "New deal",
  task: "New task",
  note: "New note",
};

const ENDPOINTS: Record<string, string> = {
  company: "companies",
  contact: "contacts",
  deal: "deals",
  task: "tasks",
  note: "notes",
};

interface FieldDef {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "url" | "number" | "date" | "textarea";
  required?: boolean;
}

const FIELDS: Record<string, FieldDef[]> = {
  company: [
    { name: "name", label: "Name", required: true, placeholder: "Acme Legal LLP" },
    { name: "website", label: "Website", placeholder: "acmelegal.co.uk", type: "url" },
    { name: "industry", label: "Industry", placeholder: "Legal" },
    { name: "location", label: "Location", placeholder: "Newcastle" },
    { name: "source", label: "Source", placeholder: "referral / linkedin / content / outbound" },
  ],
  contact: [
    { name: "name", label: "Name", required: true, placeholder: "Jane Smith" },
    { name: "email", label: "Email", type: "email", placeholder: "jane@acmelegal.co.uk" },
    { name: "title", label: "Title", placeholder: "Practice Manager" },
    { name: "company_id", label: "Company ID (optional)", placeholder: "uuid of existing company" },
    { name: "source", label: "Source", placeholder: "referral / linkedin / content / outbound" },
  ],
  deal: [
    { name: "title", label: "Title", required: true, placeholder: "Acme Legal — case management" },
    { name: "company_id", label: "Company ID", required: true, placeholder: "uuid" },
    { name: "value", label: "Value (£)", type: "number", placeholder: "25000" },
    { name: "close_date", label: "Close date", type: "date" },
  ],
  task: [
    { name: "title", label: "Title", required: true, placeholder: "Send proposal to Jane" },
    { name: "due_at", label: "Due", type: "date" },
    { name: "body", label: "Notes", type: "textarea" },
  ],
  note: [
    { name: "entity_type", label: "Entity type", required: true, placeholder: "company / contact / deal" },
    { name: "entity_id", label: "Entity ID", required: true, placeholder: "uuid" },
    { name: "body", label: "Note", type: "textarea", required: true },
  ],
};

const HREF: Record<string, (json: { id?: string; company?: { id: string }; contact?: { id: string }; deal?: { id: string }; task?: { id: string }; note?: { id: string } }) => string | undefined> = {
  company: (j) => (j.company?.id ? `/companies/${j.company.id}` : undefined),
  contact: (j) => (j.contact?.id ? `/contacts/${j.contact.id}` : undefined),
  deal: (j) => (j.deal?.id ? `/deals/${j.deal.id}` : undefined),
  task: () => `/tasks`,
  note: () => undefined,
};
