"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-5 pt-6 pb-8">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.15em] text-white">
            PELLAR
          </h1>
          <p className="mt-0.5 text-[11px] font-medium text-stone">Portal</p>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-stone hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="4" y1="4" x2="14" y2="14" />
            <line x1="14" y1="4" x2="4" y2="14" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[220px] shrink-0 flex-col bg-ink md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[260px] flex-col bg-ink shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile header bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b border-warm-gray bg-cream px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-warm-gray"
          aria-label="Open menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>
        <span className="ml-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
          PELLAR
        </span>
      </div>
    </>
  );
}
