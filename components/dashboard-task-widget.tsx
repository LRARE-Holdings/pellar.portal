import Link from "next/link";
import { shortDate } from "@/lib/format";
import { TaskCheckbox } from "@/components/task-checkbox";
import type { Task } from "@/types";

interface DashboardTaskWidgetProps {
  tasks: Task[];
}

function isOverdue(task: Task): boolean {
  if (!task.due_at) return false;
  return new Date(task.due_at) < new Date();
}

export function DashboardTaskWidget({ tasks }: DashboardTaskWidgetProps) {
  if (tasks.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-stone">
        No tasks due.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-0">
        {tasks.map((task, idx) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 px-1 py-3 ${
              idx > 0 ? "border-t border-warm-gray" : ""
            }`}
          >
            <TaskCheckbox
              taskId={task.id}
              completed={!!task.completed_at}
              label={task.title}
            />
            <Link
              href={`/tasks?id=${task.id}`}
              className="min-w-0 flex-1 transition-colors hover:text-forest"
            >
              <p className="truncate text-[13px] font-medium text-ink">
                {task.title}
              </p>
              {task.entity_type && task.entity_id && (
                <p className="mt-0.5 truncate text-[11px] text-stone">
                  {task.entity_type}
                </p>
              )}
            </Link>
            {task.due_at && (
              <span
                className={`shrink-0 text-[12px] font-medium ${
                  isOverdue(task) ? "text-red-600" : "text-stone"
                }`}
              >
                {shortDate(task.due_at)}
              </span>
            )}
          </div>
        ))}
      </div>
      <Link
        href="/tasks"
        className="mt-3 block text-right text-[12px] font-medium text-forest hover:underline"
      >
        View all
      </Link>
    </div>
  );
}
