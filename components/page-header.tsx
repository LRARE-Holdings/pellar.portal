interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/**
 * Page-level header used at the top of every primary route. Left-aligned
 * title in DM Sans 400 28px, optional muted subtitle, optional actions
 * cluster on the right.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[28px] font-normal leading-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[13px] text-stone">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface SectionHeaderProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * In-page section header. Uppercase, tight letter-spacing, 13px.
 */
export function SectionHeader({ children, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-warm-gray bg-white p-8 text-left">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="mt-1 text-[13px] text-stone">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
