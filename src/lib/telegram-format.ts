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

export function formatOverdueNudge(tasks: TaskForDisplay[]): string {
  if (tasks.length === 0) return "";

  const header = "<b>Overdue Tasks</b>\n";
  const lines = tasks.map((t) => {
    const title = escapeHtml(t.title);
    const assignee = t.assigneeName ? escapeHtml(t.assigneeName) : "Unassigned";
    const deadline = t.deadline ? formatDeadline(t.deadline) : "";
    const ago = t.deadline
      ? `(${Math.ceil((Date.now() - t.deadline.getTime()) / (1000 * 60 * 60 * 24))} days ago)`
      : "";

    return `· <b>${title}</b> — ${assignee} — was due ${deadline} ${ago}`;
  });

  return header + "\n" + lines.join("\n") + "\n\nPlease update status or adjust deadlines.";
}

export function formatStandupFallback(tasks: TaskForDisplay[], teamName: string): string {
  if (tasks.length === 0) return "";

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const header = `<b>Daily Standup — ${escapeHtml(teamName)} — ${today}</b>\n`;

  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const open = tasks.filter((t) => t.status === "open" || t.status === "proposed");

  const sections: string[] = [];

  if (inProgress.length > 0) {
    sections.push(`<b>In Progress (${inProgress.length}):</b>`);
    inProgress.forEach((t) => {
      const assignee = t.assigneeName ? escapeHtml(t.assigneeName) : "Unassigned";
      const deadline = t.deadline ? ` — due ${formatDeadline(t.deadline)}` : "";
      sections.push(`· ${escapeHtml(t.title)} — ${assignee}${deadline}`);
    });
  }

  if (blocked.length > 0) {
    sections.push(`\n<b>Blocked (${blocked.length}):</b>`);
    blocked.forEach((t) => {
      const assignee = t.assigneeName ? escapeHtml(t.assigneeName) : "Unassigned";
      sections.push(`· ${escapeHtml(t.title)} — ${assignee}`);
    });
  }

  if (open.length > 0) {
    sections.push(`\n<b>Open (${open.length}):</b>`);
    open.forEach((t) => {
      const assignee = t.assigneeName ? escapeHtml(t.assigneeName) : "Unassigned";
      sections.push(`· ${escapeHtml(t.title)} — ${assignee}`);
    });
  }

  return header + "\n" + sections.join("\n") + "\n\nHave a productive day!";
}

export function formatWeeklyFallback(data: {
  completed: number;
  created: number;
  open: number;
  overdue: number;
}): string {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const range = `${weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return [
    `<b>Weekly Report — ${range}</b>`,
    "",
    `<b>Completed:</b> ${data.completed} tasks`,
    `<b>New Tasks:</b> ${data.created}`,
    `<b>Still Open:</b> ${data.open}`,
    `<b>Overdue:</b> ${data.overdue}`,
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
