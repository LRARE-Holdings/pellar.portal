"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DashboardIcon,
  InboxIcon,
  CompaniesIcon,
  ContactsIcon,
  DealsIcon,
  TasksIcon,
  ForecastIcon,
  CalendarIcon,
  BookingsIcon,
  BriefingsIcon,
  DiscoveryIcon,
  BookingSettingsIcon,
  SignOutIcon,
  CollapseIcon,
} from "@/components/sidebar-icons";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badgeKey?: "inbox" | "tasks";
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/inbox", label: "Inbox", icon: <InboxIcon />, badgeKey: "inbox" },
  { href: "/companies", label: "Companies", icon: <CompaniesIcon /> },
  { href: "/contacts", label: "Contacts", icon: <ContactsIcon /> },
  { href: "/deals", label: "Deals", icon: <DealsIcon /> },
  { href: "/tasks", label: "Tasks", icon: <TasksIcon />, badgeKey: "tasks" },
  { href: "/forecast", label: "Forecast", icon: <ForecastIcon /> },
  { href: "/calendar", label: "Calendar", icon: <CalendarIcon /> },
  { href: "/bookings", label: "Bookings", icon: <BookingsIcon /> },
  { href: "/briefings", label: "Briefings", icon: <BriefingsIcon /> },
  { href: "/discovery", label: "Discovery", icon: <DiscoveryIcon /> },
];

const settingsItems: NavItem[] = [
  { href: "/settings/booking", label: "Booking", icon: <BookingSettingsIcon /> },
];

const COLLAPSED_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  // Persist collapsed state
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Fetch badge counts
  useEffect(() => {
    async function fetchBadges() {
      const [inboxRes, tasksRes] = await Promise.all([
        supabase
          .from("emails")
          .select("id", { count: "exact", head: true })
          .eq("direction", "inbound")
          .eq("read", false),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .is("completed_at", null)
          .lt("due_date", new Date().toISOString()),
      ]);
      setBadges({
        inbox: inboxRes.count ?? 0,
        tasks: tasksRes.count ?? 0,
      });
    }
    fetchBadges();
    const interval = setInterval(fetchBadges, 60_000);
    return () => clearInterval(interval);
  }, [supabase]);

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

  function NavLink({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
    const isActive =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    const badgeCount = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;

    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        title={isCollapsed ? item.label : undefined}
        className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-white"
            : "text-stone hover:bg-white/5 hover:text-white"
        } ${isCollapsed ? "justify-center" : ""}`}
      >
        <span className="shrink-0">{item.icon}</span>
        {!isCollapsed && <span>{item.label}</span>}
        {badgeCount > 0 && (
          <span
            className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-forest text-[10px] font-semibold text-white ${
              isCollapsed ? "absolute -right-0.5 -top-0.5" : "ml-auto"
            }`}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
        {isCollapsed && (
          <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] text-white shadow-lg group-hover:block z-50">
            {item.label}
            {badgeCount > 0 && ` (${badgeCount})`}
          </span>
        )}
      </Link>
    );
  }

  function sidebarContent(isCollapsed: boolean) {
    return (
      <>
        {/* Header */}
        <div className={`flex items-center justify-between pt-6 pb-8 ${isCollapsed ? "px-3" : "px-5"}`}>
          <div className={isCollapsed ? "flex justify-center w-full" : ""}>
            <h1
              className={`font-semibold uppercase tracking-[0.15em] text-white ${
                isCollapsed ? "text-[10px]" : "text-sm"
              }`}
            >
              {isCollapsed ? "P" : "PELLAR"}
            </h1>
            {!isCollapsed && (
              <p className="mt-0.5 text-[11px] font-medium text-stone">Portal</p>
            )}
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

        {/* Main nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} isCollapsed={isCollapsed} />
          ))}
        </nav>

        {/* Settings section */}
        <div className="px-2 pb-2">
          {!isCollapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone/60">
              Settings
            </p>
          )}
          {isCollapsed && <div className="mx-3 mb-2 border-t border-white/10" />}
          {settingsItems.map((item) => (
            <NavLink key={item.href} item={item} isCollapsed={isCollapsed} />
          ))}
        </div>

        {/* Sign out */}
        <div className="px-2 pb-3">
          <button
            onClick={handleSignOut}
            title={isCollapsed ? "Sign out" : undefined}
            className={`group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-stone transition-colors hover:bg-white/5 hover:text-white ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <span className="shrink-0"><SignOutIcon /></span>
            {!isCollapsed && <span>Sign out</span>}
            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] text-white shadow-lg group-hover:block z-50">
                Sign out
              </span>
            )}
          </button>
        </div>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden border-t border-white/10 px-2 py-2 md:block">
          <button
            onClick={toggleCollapsed}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-stone transition-colors hover:bg-white/5 hover:text-white ${
              isCollapsed ? "justify-center" : ""
            }`}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={isCollapsed} />
            {!isCollapsed && (
              <span className="text-[12px] font-medium">Collapse</span>
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden h-full shrink-0 flex-col bg-ink transition-all duration-200 ease-in-out md:flex ${
          collapsed ? "w-[60px]" : "w-[220px]"
        }`}
      >
        {sidebarContent(collapsed)}
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[260px] flex-col bg-ink shadow-xl">
            {sidebarContent(false)}
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
