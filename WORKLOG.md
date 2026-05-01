# WORKLOG - Annie Standby Coder

This file tracks meaningful standby work Annie performs on this repository.

## How to Use

- Add short dated entries for meaningful improvements, fixes, refactors, or decisions.
- Skip tiny noise.
- Prefer concise bullets over long diary entries.
- When a nightly or weekly pass makes real progress, record it here.

---

## 2026-05-01

- Added a dedicated Projects workspace page plus `/api/projects` storage so Mission Control can track multiple repos, project status, progress, next steps, and quick file jumps from one place.
- Hardened project-state loading so malformed or partial `state/projects.json` data falls back safely instead of breaking the project pulse or projects API.
- Added a new Mission Control "needs attention" layer so the homepage now calls out blockers, missing signals, idle priority pressure, and near-term scheduled work instead of just showing raw lists.
- Reduced `/api/banner` latency by moving the OpenClaw npm version check into a cached parallel fetch, then rebuilt and restarted the local dashboard so the live app picked up the faster path.

## 2026-04-30

- Hardened the new Files browser so invalid or missing paths fall back safely, available roots are discovered dynamically, and file errors return useful status codes instead of generic failures.
- Added a more compact mobile-friendly Files table layout plus clearer fallback messaging when Mission Control redirects to a safe root.
- Added `RELEASE_CHECKLIST.md` for a lightweight dashboard shipping checklist.
- Added a project pulse panel to the Mission Control homepage so pinned/active projects, progress, and next steps surface alongside live work.
- Added Annie-style recommendation guidance and source-health badges to make the dashboard more actionable and easier to trust at a glance.
- Rebuilt and restarted the local dashboard after finding port 3000 still serving a stale prior build.

## 2026-04-28

- Linked repository to GitHub via SSH.
- Configured Git identity for Annie.
- Enabled standby coder mode with commit, push, and automatic branch management.
- Added `TODO.md` as the primary backlog.
- Added `STANDBY.md` with workflow, branch conventions, and commit conventions.
- Scheduled nightly standby coding automation.
- Added repo healthcheck, weekly refactor pass, and branch cleanup automation.
- Chose Annie product direction: internal leverage tools first.
- Chose phased roadmap: Control Center → Automation Toolbox → Opportunity/Profit Layer.
- Added a Phase 1 control center layer to the feed page: active priorities from `TODO.md`, a busy-now work panel, and an upcoming agenda sourced from cron state.
- Hardened Mission Control session loading so missing/partial OpenClaw state degrades gracefully instead of breaking the dashboard.
- Added an Annie-style control-center status strip with focus guidance, source health badges, and manual refresh context.
- Split feed and control-center loading so one unavailable API no longer blanks the whole dashboard.
- Rebuilt and restarted the local dashboard service so the live app picked up the current API routes again.
