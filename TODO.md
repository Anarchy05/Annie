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
- [ ] Define the next 3 highest-value features that make Annie more useful to a technophobe.
- [x] Design Annie first as an autonomous money-making builder: internal leverage tools first, sellable products later.
- [x] Choose the first productizable wedge Annie should pursue and turn it into an execution plan. Chosen direction: build internal tools that make Vorster faster and more profitable first.
- [x] Identify the first internal profit/leverage tool Annie should build for Vorster. Chosen direction: a control center first, then an automation toolbox, then an opportunity/profit layer.
- [ ] Define success metrics for Annie's first internal leverage tool.
- [ ] Break Phase 1 into concrete deliverables and implementation order.

### P0 - Phase 1 Build Targets

- [ ] Add an active priorities panel to Mission Control.
- [ ] Add a real tasks/work tracker layer instead of just raw sessions and cron jobs.
- [ ] Add a clearer “what Annie is busy with now” surface.
- [ ] Add a daily inbox/agenda style summary view.
- [ ] Add a compact mobile-friendly command center view.

### P0 - Reliability

- [ ] Harden all dashboard API routes against missing/partial local OpenClaw state.
- [ ] Add graceful empty states for every panel/page when backing data is unavailable.
- [ ] Reduce dashboard service restarts and document stable service management.

### P1 - Performance

- [ ] Add smarter cache invalidation for banner/feed/cron/search data.
- [ ] Lazy-load heavy dashboard sections and reduce initial payload size.
- [ ] Add lightweight timing diagnostics to identify slow internal routes quickly.

### P1 - Chat Experience

- [ ] Add drag-and-drop uploads to the chat page.
- [ ] Improve markdown rendering with better tables, blockquotes, and links.
- [ ] Add a conversation sidebar or archive browser for old web-chat sessions.
- [ ] Explore streaming-style replies if a safe backend path exists.

### P1 - Mission Control UX

- [ ] Improve sub-agent and active-work visibility so “busy with” is more useful.
- [ ] Add better cron run visibility and history where available.
- [ ] Add a compact dashboard summary view for quick mobile use.

### P2 - Repo / Workflow

- [ ] Add a CHANGELOG or WORKLOG for meaningful Annie-made improvements.
- [ ] Add a lightweight release checklist for dashboard changes.
- [ ] Consider adding tests for core dashboard data helpers.

## Inbox / Ideas

- [ ] Add voice input/output options to chat.
- [ ] Add theme personalization controls.
- [ ] Add a project switcher if more repos become standby-managed.

## Done

- [x] Linked repository to GitHub via SSH.
- [x] Enabled Annie standby coder mode with commit/push/branch permissions.
- [x] Added Annie Mission Control branding, resource usage, and dashboard chat.
