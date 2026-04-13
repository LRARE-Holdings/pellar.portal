"use client";

import { useRouter } from "next/navigation";

const ACTIONS = [
  { label: "Deal", href: "/deals" },
  { label: "Company", href: "/companies" },
  { label: "Contact", href: "/contacts" },
  { label: "Task", href: "/tasks" },
] as const;

export function DashboardQuickActions() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => router.push(action.href)}
          className="inline-flex items-center gap-1 rounded-md border border-forest px-3 py-1.5 text-[13px] font-medium text-forest transition-colors hover:bg-light-sage"
        >
          <span className="text-[14px] leading-none">+</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}
