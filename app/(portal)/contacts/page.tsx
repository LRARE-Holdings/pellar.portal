import Link from "next/link";
import { listContacts } from "@/lib/services/contacts";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  search?: string;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const contacts = await listContacts({
    search: params.search,
    limit: 200,
  });

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} ${
          contacts.length === 1 ? "contact" : "contacts"
        }`}
      />

      <form className="mb-6">
        <input
          type="search"
          name="search"
          placeholder="Search by name, email or title"
          defaultValue={params.search ?? ""}
          className="w-full max-w-md rounded-lg border border-warm-gray bg-white px-4 py-2 text-[13px] text-ink placeholder:text-stone focus:border-forest focus:outline-none"
        />
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          body="Contacts are created automatically when leads come in via the contact form, and manually via cmd+K."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-warm-gray bg-cream text-[11px] font-semibold uppercase tracking-[0.05em] text-stone">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Last touch</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-warm-gray last:border-0 hover:bg-cream"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="font-medium text-ink hover:text-forest"
                    >
                      {c.name}
                    </Link>
                    {c.is_primary ? (
                      <Badge variant="forest" className="ml-2">
                        Primary
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-stone">{c.title ?? "—"}</td>
                  <td className="px-5 py-3">
                    {c.company ? (
                      <Link
                        href={`/companies/${c.company.id}`}
                        className="text-ink hover:text-forest"
                      >
                        {c.company.name}
                      </Link>
                    ) : (
                      <span className="text-stone">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-stone">{c.email ?? "—"}</td>
                  <td className="px-5 py-3 text-stone">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-stone">
                    {relativeTime(c.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
