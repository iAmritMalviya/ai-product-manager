# Phase 5: Scheduled Features

**Status:** Not Started
**Depends on:** Phase 4 (bot can respond, tasks in DB)
**Delivers:** Daily standups, overdue nudges, weekly reports — all automated

---

## What Gets Built

1. **Daily standup** — bot sends morning summary to each team: open tasks, who's working on what, what's due today
2. **Overdue nudge** — bot pings the group when tasks pass their deadline
3. **Weekly report** — end-of-week summary: tasks completed, new tasks, blockers, team velocity
4. **Team timezone support** — standup/nudge times respect `teams.timezone`
5. **BullMQ repeatable jobs** — cron-based scheduling, one job per team
6. **AI summarizer** — GPT-4o generates natural-language summaries from raw task data

## Key Files

| File | Purpose |
|------|---------|
| `src/scheduler/register.ts` | Register repeatable jobs for all teams on startup |
| `src/scheduler/standup.ts` | Daily standup logic: query tasks → summarize → send |
| `src/scheduler/nudge.ts` | Overdue check: query overdue → format → send |
| `src/scheduler/weekly-report.ts` | Weekly report: aggregate week's data → summarize → send |
| `src/ai/summarizer.ts` | `generateStandup(tasks, members)`, `generateWeeklyReport(data)` |
| `src/ai/prompts/summarizer.md` | System prompt for summaries |
| `src/db/queries/tasks.ts` | Add: getOverdueTasks, getTasksDueToday, getTasksCompletedThisWeek |

## Scheduled Jobs

| Job | Schedule (default) | Configurable via |
|-----|-------------------|-----------------|
| Daily standup | `0 9 * * 1-5` (9am weekdays) | `teams.standup_cron` |
| Overdue nudge | `0 10,15 * * 1-5` (10am, 3pm weekdays) | Hardcoded initially |
| Weekly report | `0 17 * * 5` (5pm Friday) | Hardcoded initially |

## Standup Format

> **Daily Standup — Monday, Apr 7**
>
> **Due Today:**
> - Auth module — @amrit (in progress)
>
> **In Progress (3):**
> - Auth module — @amrit — due today
> - Payment refactor — @ravi — due Wed
> - Landing page — @priya — no deadline
>
> **Blocked (1):**
> - API migration — @amrit — "waiting for staging access"
>
> **Unassigned (1):**
> - Update docs — no deadline
>
> Have a productive day!

## Overdue Nudge Format

> **Overdue Tasks**
>
> - **Auth module** — @amrit — was due Apr 4 (3 days ago)
> - **Design review** — @priya — was due Apr 5 (2 days ago)
>
> Please update status or adjust deadlines.

## Weekly Report Format

> **Weekly Report — Mar 31 to Apr 6**
>
> **Completed (5):** Auth module, Bug #42, ...
> **New Tasks (3):** Payment refactor, ...
> **Still Open (8):** 3 in progress, 2 blocked, 3 unassigned
> **Overdue (2):** Design review, API migration
>
> **Team Velocity:** 5 tasks completed (up from 3 last week)

## Implementation Details

### Job Registration (on startup)
```
For each team in DB:
  1. Register standup repeatable job with team's cron + timezone
  2. Register nudge repeatable job
  3. Register weekly report repeatable job
```

### New Team Handling
When a new team is auto-created (Phase 3), register its scheduled jobs immediately.

### Timezone Support
- `teams.timezone` column (default: "UTC")
- BullMQ repeatable jobs support timezone via `tz` option
- Parse timezone from team config or default

### AI Summarizer
- GPT-4o (not mini) for summaries — better natural language
- Input: structured task data (JSON)
- Output: formatted Telegram message (HTML)
- Keep summaries concise — no one reads walls of text

## New Dependencies

None — BullMQ repeatable jobs + existing stack covers everything.

## Definition of Done

- [ ] On startup, repeatable jobs registered for each team
- [ ] At 9am (team timezone), standup message sent to group with correct task data
- [ ] At 10am/3pm, overdue tasks nudged if any exist
- [ ] On Friday 5pm, weekly report sent with accurate completion stats
- [ ] Standup skipped if no active tasks (don't send empty standups)
- [ ] Nudge skipped if no overdue tasks
- [ ] New team gets scheduled jobs immediately after creation
- [ ] `daily_summaries` table stores sent summaries (no duplicate sends)
- [ ] Timezone respected — 9am IST for India team, 9am EST for US team

## Notes

- Use `daily_summaries` table to prevent duplicate sends (unique on team_id + summary_date)
- GPT-4o for summaries costs more but produces much better prose — worth it for 1 summary/day
- Don't overdo nudges — 2x/day max for overdue, once/day for standup
- Weekly report should feel like a real PM wrote it, not a database dump
