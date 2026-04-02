"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/outreach", label: "Outreach" },
  { href: "/briefings", label: "Briefings" },
  { href: "/analytics", label: "Analytics" },
  { href: "/calendar", label: "Calendar" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-ink">
      <div className="px-5 pt-6 pb-8">
        <h1 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
          PELLAR
        </h1>
        <p className="mt-0.5 text-[11px] font-medium text-stone">Portal</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-stone hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={handleSignOut}
          className="w-full rounded-md px-3 py-2 text-left text-[13px] font-medium text-stone transition-colors hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
