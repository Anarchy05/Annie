# TODO - Annie Standby Backlog

This file is Annie's default backlog for background coding on this repository.

## How Annie Should Use This

- Work top to bottom unless priorities change.
- Prefer small, working improvements over giant risky rewrites.
- Move completed items into the Done section with a short note.
- Add newly discovered follow-up work to the appropriate section.
- Keep the app buildable.

## Mission Lens

Use this lens when choosing what to build next:

- make Annie feel more capable, trustworthy, and distinctive
- reduce friction for non-technical or low-technical users
- improve practical usefulness before flashy complexity
- favor features that create leverage, autonomy, and real-world value
- look for opportunities that could become profitable tools, workflows, or products

## Product Roadmap

### Phase 1 - Control Center

Turn Annie's Mission Control into a practical operator console for Vorster.

Core goals:
- show what matters now
- reduce cognitive overhead
- make active work, priorities, and status obvious
- give Annie a cleaner control surface for real assistance

### Phase 2 - Automation Toolbox

Add reusable actions, workflows, and saved automations underneath the control center.

Core goals:
- save repeatable time
- make Annie more autonomous in useful ways
- create building blocks for daily leverage

### Phase 3 - Opportunity / Profit Layer

Add opportunity tracking, profit-oriented workflows, and systems that help identify and convert value.

Core goals:
- spot worthwhile opportunities
- track them cleanly
- turn Annie from helper into leverage engine

## Current Priorities

### P0 - Direction

- [x] Turn Annie's mission into a concrete product roadmap for Mission Control and the broader Annie project.
- [x] Define the next 3 highest-value features that make Annie more useful to a technophobe. Chosen order: compact mobile command center, graceful empty/error states across the dashboard, and drag-and-drop uploads in chat.
- [x] Design Annie first as an autonomous money-making builder: internal leverage tools first, sellable products later.
- [x] Choose the first productizable wedge Annie should pursue and turn it into an execution plan. Chosen direction: build internal tools that make Vorster faster and more profitable first.
- [x] Identify the first internal profit/leverage tool Annie should build for Vorster. Chosen direction: a control center first, then an automation toolbox, then an opportunity/profit layer.
- [x] Define success metrics for Annie's first internal leverage tool. Success metrics: understand what matters now in under 10 seconds; core dashboard pages stay usable when some OpenClaw data is missing; common phone actions need minimal scrolling/tapping.
- [x] Break Phase 1 into concrete deliverables and implementation order. Chosen order: reliability/empty states, compact mobile view, chat uploads, then conversation sidebar/archive.

### P0 - Phase 1 Build Targets

- [x] Add an active priorities panel to Mission Control.
- [x] Add a real tasks/work tracker layer instead of just raw sessions and cron jobs.
- [x] Add a clearer “what Annie is busy with now” surface.
- [x] Add a daily inbox/agenda style summary view.
- [x] Add graceful empty/error states for every dashboard panel/page when backing data is unavailable. Feed panels now distinguish truly empty reads from degraded sources, and the dashboard keeps actionable refresh/degraded messaging instead of collapsing into misleading blanks.
- [x] Add a compact mobile-friendly command center view. Added a sticky mobile command dock on the feed with one-tap jumps into priorities, live work, task runway, chat, and the next beat so Mission Control stays steerable from a phone.
- [x] Add drag-and-drop uploads to the chat page.
- [x] Add a conversation sidebar or archive browser for old web-chat sessions. Added a chat archive browser that lists saved conversations, shows previews/message counts, and lets Annie's web chat open old transcripts in a read-only view.

### P0 - Reliability

- [x] Harden all dashboard API routes against missing/partial local OpenClaw state. Mission Control now salvages valid session/cron rows from partially malformed OpenClaw files, marks those reads as degraded instead of breaking whole panels, and covers the new parser layer with focused tests.
- [x] Let the feed and control-center panels degrade independently when one live API is unavailable.
- [x] Add graceful empty/error states for every dashboard panel/page when backing data is unavailable. The remaining feed/control-center gaps now treat quiet sources as empty instead of degraded, while preserving targeted warning states when real reads fail.
- [x] Reduce dashboard service restarts and document stable service management. The restart helper now cleanly restarts an existing transient unit instead of colliding with it.
### P1 - Performance

- [ ] Add smarter cache invalidation for banner/feed/cron/search data.
- [x] Lazy-load heavy dashboard sections and reduce initial payload size. Split automation health into a separate feed fetch so recent cron-run signals can load without blocking the main dashboard.
- [x] Add lightweight timing diagnostics to identify slow internal routes quickly. Added route timing capture plus a banner speed read and `/api/diagnostics`, then used it to cap the slow memory-search path so search stays responsive.

### P1 - Chat Experience

- [x] Improve markdown rendering with better tables, blockquotes, and links.
- [ ] Explore streaming-style replies if a safe backend path exists.

### P1 - Mission Control UX

- [x] Improve sub-agent and active-work visibility so “busy with” is more useful. Split current work into clearer live/recent sections and highlight active threads on the feed.
- [x] Add better cron run visibility and history where available. Added an Automation Watch panel on the feed with recent cron-run health plus the next scheduled beats.
- [x] Add a compact dashboard summary view for quick mobile use. Added an Annie brief strip for top priority, live thread, and next beat on the feed.
- [x] Add clearer dashboard quick actions so the feed becomes easier to steer from mobile or at-a-glance use. Added an Annie quick-actions strip with direct jumps into priorities, task runway, automation watch, projects, and chat.

### P2 - Repo / Workflow

- [x] Add a CHANGELOG or WORKLOG for meaningful Annie-made improvements.
- [x] Add a lightweight release checklist for dashboard changes.
- [x] Added focused tests for core dashboard derivation helpers after splitting the pure control-center/feed/automation logic out of the main server data module.
- [x] Add a small integration test layer around dashboard file/OpenClaw boundary fallbacks. Added fallback-shape coverage for the control-center, automation-watch, banner, and feed degraded payloads so dashboard reliability regressions get caught quickly.

## Inbox / Ideas

- [ ] Add voice input/output options to chat.
- [ ] Add theme personalization controls.
- [ ] Add a project switcher if more repos become standby-managed.

## Done

- [x] Linked repository to GitHub via SSH.
- [x] Enabled Annie standby coder mode with commit/push/branch permissions.
- [x] Added Annie Mission Control branding, resource usage, and dashboard chat.
- [x] Added a Phase 1 control center strip on the feed page with active priorities, a busy-now panel, and an upcoming agenda view.
- [x] Added a homepage project pulse with tracked-project progress, next-step guidance, and source-health badges.
- [x] Added a dedicated Projects page and API-backed tracker for multi-repo workspace status, progress, and next steps.
- [x] Improved chat markdown rendering so Annie now displays headings, blockquotes, tables, inline code, and clickable links more cleanly.
- [x] Tightened the task-runway signal so older failed tasks no longer inflate Annie's live attention count, while still surfacing a separate older-failure indicator when useful.
- [x] Grouped repeated recent task failures/completions into cleaner runway cards with repeat counts so one noisy automation no longer floods Mission Control.
- [x] Added automation-watch triage guidance so Mission Control can distinguish likely runtime hiccups from job-specific failures and show next-beat timing directly on each automation card.
