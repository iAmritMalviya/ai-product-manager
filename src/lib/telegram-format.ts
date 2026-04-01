export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface TaskForDisplay {
  title: string;
  status: string;
  priority: string | null;
  deadline: Date | null;
  assigneeName: string | null;
}

const statusLabels: Record<string, string> = {
  proposed: "Proposed",
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTaskList(tasks: TaskForDisplay[]): string {
  if (tasks.length === 0) {
    return "<i>No active tasks found.</i>";
  }

  const header = `<b>Active Tasks (${tasks.length})</b>\n`;
  const lines = tasks.map((t, i) => {
    const title = escapeHtml(t.title);
    const status = statusLabels[t.status] ?? t.status;
    const assignee = t.assigneeName ? escapeHtml(t.assigneeName) : "Unassigned";
    const deadline = t.deadline ? formatDeadline(t.deadline) : "No deadline";

    return `${i + 1}. <b>${title}</b>\n   ${status} · ${assignee} · ${deadline}`;
  });

  return header + "\n" + lines.join("\n\n");
}

export function formatSingleTask(task: TaskForDisplay): string {
  const title = escapeHtml(task.title);
  const status = statusLabels[task.status] ?? task.status;
  const assignee = task.assigneeName ? escapeHtml(task.assigneeName) : "Unassigned";
  const deadline = task.deadline ? formatDeadline(task.deadline) : "No deadline";
  const priority = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "None";

  return [
    `<b>${title}</b>`,
    `Status: ${status}`,
    `Assignee: ${assignee}`,
    `Priority: ${priority}`,
    `Deadline: ${deadline}`,
  ].join("\n");
}

export function formatHelp(): string {
  return [
    "<b>SuperCFO Bot Commands</b>",
    "",
    "/tasks — List all active tasks for this group",
    "/mytasks — List tasks assigned to you",
    "/status &lt;task&gt; — Show status of a specific task",
    "/help — Show this help message",
    "/ping — Check if bot is alive",
  ].join("\n");
}
