# WORKLOG - Annie Standby Coder

This file tracks meaningful standby work Annie performs on this repository.

## How to Use

- Add short dated entries for meaningful improvements, fixes, refactors, or decisions.
- Skip tiny noise.
- Prefer concise bullets over long diary entries.
- When a nightly or weekly pass makes real progress, record it here.

---

## 2026-05-23

- Tightened Mission Control's top-level dashboard freshness so the control-center, automation watch, and task runway caches now invalidate as soon as their real local state changes instead of waiting out the old 10-20s TTLs; Annie's main dashboard cards now react much faster to task, cron-run, backlog, project, and session updates.
- Re-verified the cache-freshness pass with clean `npm test`, `npm run lint`, and `npm run build` checks, then restarted the dashboard service and confirmed `/health` returned live.

## 2026-05-22

- Overrode Mission Control's transitive `postcss` copy to `^8.5.12` so Next no longer drags an audited vulnerable `8.4.31` subtree into the production dependency graph; `npm audit --omit=dev` is now clean again.
- Re-verified the dependency maintenance pass with clean `npm test`, `npm run lint`, and `npm run build` checks, then restarted the dashboard service and confirmed `/health` returned live.
- Added an "Annie's nudge" spotlight card to the top of the feed so Mission Control now surfaces one clearest next move immediately — refresh a fuzzy read, inspect hot tasks, check failing automation, steer a live thread, or jump straight to the top priority/project pulse — instead of making the operator scan several cards first.
- Tightened Mission Control's runtime cache invalidation so session, backlog, project pulse, cron jobs, cron runs, feed, and cached search reads now roll forward immediately when their backing files change instead of waiting out the full TTL.
- Re-verified the feed-guidance/cache pass with clean `npm test`, `npm run lint`, and `npm run build` checks.

## 2026-05-21

- Tightened the feed's task-runway signal so repeated recent failures/completions now collapse into grouped issue cards with repeat counts instead of flooding Mission Control with near-identical rows; Annie still keeps the true attention/done totals, but the runway reads much more clearly when one automation is failing over and over.
- Re-verified the task-noise pass with clean `npm test`, targeted `npx eslint src tests --max-warnings=0`, and `npm run build` checks, then restarted the dashboard service and confirmed `/health` plus `/api/control-center` returned cleanly.

## 2026-05-19

- Added a compact mobile command dock to the feed so Mission Control now stays useful on a phone with one-tap jumps into priorities, live work, task runway, chat, and the next automation beat without hunting through the whole page.
- Fixed a real feed startup/perf bug: Mission Control no longer waits for the slower automation-watch request before clearing the main dashboard skeleton, so priorities/current work render as soon as control-center data is ready while automation keeps loading independently.
- Hardened the feed refresh loop against overlapping polls/manual refreshes so older responses stop racing in and overwriting fresher dashboard state.

## 2026-05-18

- Finished the feed/control-center empty-state pass so source health now distinguishes quiet-but-healthy reads from truly degraded ones; Mission Control stops treating “nothing happening” as a warning and shows targeted schedule/task refresh states where data actually failed.
- Re-verified the reliability pass with clean `npm test`, `npm run lint`, and `npm run build` checks.

## 2026-05-17

- Hardened the feed against refresh hiccups so Mission Control now keeps showing the last good control-center and automation-watch snapshot instead of blanking into misleading empty/error states; Annie now says clearly when the view is stale but still usable.
- Pulled the feed page’s growing client logic into a dedicated `feed-view-model` module plus shared feed card components, shrinking the page back toward orchestration instead of mixing UI, stale-state policy, and quick-action decisions in one 1,000-line file.
- Added focused `feed-view-model` coverage for stale snapshot handling, first-load blocking errors, live-vs-recent work splitting, and quick-action prioritization so the feed’s operator UX rules are now testable without rendering the whole page.
- Re-verified the weekly refactor pass with clean `npm test`, targeted `npx eslint ... --max-warnings=0`, and `npm run build` checks, restarted the dashboard service, and confirmed `/health` plus `/feed` returned cleanly.

## 2026-05-16

- Hardened the feed’s degraded-state UX so panel-level failures now say what actually went fuzzy instead of quietly pretending everything is empty; Mission Control now keeps Annie’s tone while offering direct refresh actions for priorities, live work, task runway, automation watch, schedule, and project pulse.
- Started the feed’s automation-watch fetch in parallel with the main control-center request so the dashboard wakes up a bit faster instead of serially waiting on that second call.
- Re-verified the pass with clean `npm run lint` and `npm run build`, restarted the dashboard service, and confirmed `/health` plus `/feed` returned cleanly.
- Hardened the Projects flow so `/api/projects` now returns cleaner 400/404 responses for malformed or missing input, while the Projects page keeps stale cards visible on refresh failures and swaps empty-space dead ends for actionable degraded-state panels.

## 2026-05-15

- Added an Annie-style quick actions strip to the feed so Mission Control now turns live attention, automation trouble, upcoming beats, and project guidance into direct next-click actions instead of just passive status cards.
- Added anchor targets for the feed's major panels, making the dashboard feel more like a compact command center on mobile and faster to navigate when something needs attention.
- Re-verified the pass with clean `npm run lint` and `npm run build` checks.

## 2026-05-14

- Tightened the task-runway signal so Mission Control now counts only fresh failed tasks in Annie's live attention bucket, tucks older failures into a separate “older” count, and stops stale historical noise from making the dashboard feel more broken than it is.
- Re-verified the task-noise pass with clean `npm test`, `npm run lint`, and `npm run build` checks, then restarted the dashboard service.

## 2026-05-13

- Cleaned up Mission Control's live work/task wording so the dashboard now turns raw OpenClaw session keys and noisy sub-agent prompt blobs into clearer Annie-style labels like automation heartbeat, WhatsApp session, and sub-agent handoff.
- Trimmed and normalized task/session detail text so active work and task-runway panels stay useful at a glance instead of dumping long internal strings.
- Re-verified the polish pass with clean `npm test`, `npm run lint`, and `npm run build` checks.

## 2026-05-12

- Fixed `scripts/restart-dashboard-service.sh` so it now checks a unit's `LoadState` instead of trusting `systemctl show`'s exit code, which can report success even for missing units and break fresh restart attempts.
- Re-verified the helper with a clean `bash -n scripts/restart-dashboard-service.sh` pass, an actual dashboard restart, and a live `curl http://127.0.0.1:3000/health` check; confirmed `origin/main` still matches local `main` and `npm outdated` stayed quiet.

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
