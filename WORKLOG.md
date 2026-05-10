# WORKLOG - Annie Standby Coder

This file tracks meaningful standby work Annie performs on this repository.

## How to Use

- Add short dated entries for meaningful improvements, fixes, refactors, or decisions.
- Skip tiny noise.
- Prefer concise bullets over long diary entries.
- When a nightly or weekly pass makes real progress, record it here.

---

## 2026-05-10

- Added a direct `/health` route alias that re-exports the existing API health handler, so Mission Control now exposes a conventional app healthcheck path alongside `/api/health`.
- Re-verified the health-route pass with clean `npm test`, `npm run lint`, and `npm run build` checks, confirmed the local dashboard answered cleanly on both `/api/health` and `/health`, and confirmed `origin/main` remained reachable with no new npm outdated signals.
- Added a shared runtime cache layer with in-flight request deduping and failure-safe retry behavior, then moved Mission Control’s dashboard loaders onto it so concurrent banner/feed/control-center polls stop re-doing the same filesystem and OpenClaw work.
- Added a shared JSON route wrapper for diagnostics, `no-store` headers, degraded fallbacks, and structured error responses, then moved the main dashboard/search/projects/health endpoints onto it to cut repeated boilerplate and keep route behavior more coherent.
- Added focused cache-behavior coverage, then re-verified the refactor with clean `npm test`, `npm run lint`, and `npm run build` checks.
- Slimmed the top-banner API down to the fields the UI actually renders, removing unused task/sub-agent/resource payload from every poll and trimming unnecessary background work from the dashboard chrome.
- Paused the navbar/banner health polling while the tab is hidden and resumed on visibility, so Mission Control stays lighter when it’s open in the background without losing Annie’s live feel.
- Re-verified the pass with clean `npm test`, `npm run lint`, and `npm run build` checks, then restarted the dashboard service.

## 2026-05-09

- Added lightweight internal route timing diagnostics for Mission Control’s key APIs (`banner`, `control-center`, `automation-watch`, `search`, `feed`, `health`, and `projects`), exposed them at `/api/diagnostics`, and surfaced Annie’s live speed read directly in the top banner so slow paths are visible without leaving the dashboard.
- Used the new diagnostics to catch a real latency issue in search, then capped the memory-search tool path with a short timeout so file/session/task hits still return promptly instead of the whole search view stalling for ~14 seconds.
- Re-verified the pass with clean `npm test`, `npm run lint`, and `npm run build` checks, then restarted the dashboard service.
- Bumped the core web stack from Next 16.2.4 / React 19.2.5 to Next 16.2.6 / React 19.2.6 (plus `eslint-config-next`), re-verified with clean `npm test`, `npm run lint`, and `npm run build`, and restarted the dashboard service after the update.

## 2026-05-08

- Fixed a real dashboard usefulness gap in cron scheduling: Mission Control now derives upcoming run times directly from stored cron/every schedules when OpenClaw job state omits `nextRunAtMs`, so the feed and Schedule page stop showing empty "no upcoming jobs" states even though jobs exist.
- Added focused schedule-derivation coverage for recurring, stepped, staggered, and weekly cron cases, then re-verified the change with clean `npm test`, `npm run lint`, and `npm run build` checks before restarting the dashboard service.

## 2026-05-07

- Turned search into a real jump surface instead of a dead end: file and memory hits now open directly into Mission Control with line-aware file previews, task hits jump to the schedule, and conversation hits can deep-link straight into archived Annie chats.
- Added safe in-dashboard text file previews to the Files browser, including line numbers, direct download/copy actions, highlighted deep-linked lines, and API coverage for previewable-vs-binary files so code/log search results are much more useful.

## 2026-05-05

- Added fallback coverage for degraded dashboard payloads plus safer `/api/banner` and `/api/feed` responses, so the top status strip and feed API stay renderable instead of collapsing into raw 500s when local Mission Control data is unavailable.
- Added a real chat archive browser so Mission Control now surfaces saved Annie web-chat conversations with previews, message counts, live-vs-archived state, and a clean read-only archive view instead of hiding cleared transcripts in the filesystem.
- Added drag-and-drop chat uploads so files can now be dropped straight onto Annie's chat surface, with clearer attachment guidance, a live drop target, deduped upload chips, and failed-send recovery that restores queued files instead of losing them.
- Hardened the Files browser so out-of-root paths, missing nested folders, and file-targeted deep links now fall back to the nearest safe directory instead of erroring; added route tests for those boundary cases and clearer fallback guidance in the UI.

## 2026-05-04

- Locked in Phase 1 product decisions with Vorster: prioritize graceful empty/error states, a compact mobile command center, and drag-and-drop chat uploads; defined success metrics around 10-second clarity, degraded-state usability, and low-friction phone use; and fixed the implementation order accordingly in `TODO.md`.
- Started the first reliability pass by teaching the control-center and automation-watch APIs to degrade into safe fallback payloads instead of throwing 500s, then added clearer empty/error states on the search, calendar, and projects pages.
- Improved Annie's chat markdown rendering so replies now display headings, blockquotes, tables, inline code, and clickable links in a cleaner, more readable layout.
- Added focused parser tests for the new chat markdown helpers, then re-verified the pass with clean `npm test`, `npm run lint`, and `npm run build` checks.
- Added a real task-runway layer to the feed so Mission Control now turns raw OpenClaw task history into live/queued/attention/done counts plus a clearer recent task flow panel.
- Normalized newer OpenClaw task fields (`label`, `task`, `lastEventAt`, `terminalSummary`, child session keys) so active work and focus guidance now show meaningful task names and timestamps instead of generic `cron` placeholders.
- Re-verified the task-tracker pass with clean `npm test`, `npm run lint`, and `npm run build`, then restarted the local dashboard service and confirmed `/api/health` stayed live.

## 2026-05-03

- Taught dashboard cron-run loading to read the local OpenClaw `cron/runs/*.jsonl` files first, with the CLI path kept as a fallback, so recent automation history stays available even when the CLI path is slower or less reliable.
- Re-verified the cron-run loading reliability change with a clean `npm test`, `npm run lint`, and `npm run build` pass during the daily healthcheck.
- Split the oversized `src/lib/dashboard.ts` module by extracting pure dashboard derivation/types into `src/lib/dashboard-derived.ts`, making the control-center/feed/automation logic easier to reason about and safer to evolve without touching the OpenClaw/file-system wiring.
- Added a lightweight Node test suite for the new pure dashboard helpers (`npm test`), covering priority parsing, active-work shaping, agenda ordering, attention/recommendation rules, and automation-watch status sorting.
- Replaced the repo search shell fallback with a plain `grep` path that works in this environment even when `rg` is unavailable, avoiding a silent degraded search path.
- Re-verified the refactor with a clean `npm test`, `npm run lint`, and `npm run build` pass.
- Added a lazy-loaded Automation Watch panel to the feed so Annie now surfaces recent cron-run health, failing/skipped automation signals, and the next scheduled beats without slowing down the main control-center payload.
- Split automation-run insight into a dedicated `/api/automation-watch` route, then re-verified the dashboard with a clean lint pass and a successful production build before restart.
- Fixed `scripts/restart-dashboard-service.sh` so it now restarts the existing transient systemd unit cleanly instead of failing on unit-name collisions.

## 2026-05-02

- Bumped `react` and `react-dom` from 19.2.4 to 19.2.5, then re-verified the dashboard with a clean lint pass, a successful production build, and a live `/api/health` check.
- Added a compact "Annie brief" strip to the feed so mobile and quick-glance views now surface the top priority, hottest thread, and next automation beat without needing to scan the whole dashboard.
- Reworked the feed's current-work panel into clearer live-vs-recent sections with stronger highlighting for actively running threads, making Annie's busy-now state easier to read.
- Reduced unnecessary dashboard polling by pausing feed auto-refresh while the tab is hidden and triggering a refresh when the page becomes visible again, then rebuilt and restarted the local service.

## 2026-05-01

- Added a `scripts/restart-dashboard-service.sh` helper plus README guidance so the dashboard can be relaunched under a stable transient unit instead of drifting into a failed-unit/manual-process split on port 3000.
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
