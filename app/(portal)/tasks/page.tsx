import { listTasks } from "@/lib/services/tasks";
import { PageHeader, SectionHeader, EmptyState } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { TaskCheckbox } from "@/components/task-checkbox";
import { dateTime, relativeTime } from "@/lib/format";
import type { Task } from "@/types";

export const dynamic = "force-dynamic";

function bucketTasks(tasks: Task[]): {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDate: Task[];
} {
  const now = new Date();
  const nowMs = now.getTime();
  return {
    overdue: tasks.filter(
      (t) => t.due_at && new Date(t.due_at).getTime() < nowMs,
    ),
    today: tasks.filter(
      (t) =>
        t.due_at &&
        isSameDay(new Date(t.due_at), now) &&
        new Date(t.due_at).getTime() >= nowMs,
    ),
    upcoming: tasks.filter(
      (t) =>
        t.due_at &&
        new Date(t.due_at).getTime() >= nowMs &&
        !isSameDay(new Date(t.due_at), now),
    ),
    noDate: tasks.filter((t) => !t.due_at),
  };
}

export default async function TasksPage() {
  const tasks = await listTasks({ limit: 200 });
  const { overdue, today, upcoming, noDate } = bucketTasks(tasks);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} open · ${overdue.length} overdue`}
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="No open tasks"
          body="Press cmd+K to add a task. They show in the Inbox when due."
        />
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <TaskGroup
              title={`Overdue · ${overdue.length}`}
              tasks={overdue}
              variant="danger"
            />
          )}
          {today.length > 0 && (
            <TaskGroup
              title={`Today · ${today.length}`}
              tasks={today}
              variant="warning"
            />
          )}
          {upcoming.length > 0 && (
            <TaskGroup
              title={`Upcoming · ${upcoming.length}`}
              tasks={upcoming}
              variant="sage"
            />
          )}
          {noDate.length > 0 && (
            <TaskGroup
              title={`No due date · ${noDate.length}`}
              tasks={noDate}
              variant="stone"
            />
          )}
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  variant,
}: {
  title: string;
  tasks: Task[];
  variant: "danger" | "warning" | "sage" | "stone";
}) {
  return (
    <section>
      <SectionHeader>{title}</SectionHeader>
      <div className="overflow-hidden rounded-lg border border-warm-gray bg-white">
        {tasks.map((task, idx) => (
          <div
            key={task.id}
            className={`flex items-start gap-4 px-5 py-4 ${
              idx === 0 ? "" : "border-t border-warm-gray"
            }`}
          >
            <TaskCheckbox
              taskId={task.id}
              completed={!!task.completed_at}
              label={task.title}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{task.title}</p>
              {task.body && (
                <p className="mt-0.5 line-clamp-1 text-[12px] text-stone">
                  {task.body}
                </p>
              )}
            </div>
            {task.due_at && (
              <div className="shrink-0 text-right">
                <Badge variant={variant}>{relativeTime(task.due_at)}</Badge>
                <p className="mt-1 text-[10px] text-stone">
                  {dateTime(task.due_at)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
