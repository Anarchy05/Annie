# Annie

Annie is a personalized Mission Control dashboard and standby-coder workspace built on Next.js, Tailwind CSS, and TypeScript.

## What this repo is for

This repository is Annie's control center and autonomous workbench.

Current direction:
- Phase 1: Control Center
- Phase 2: Automation Toolbox
- Phase 3: Opportunity / Profit Layer

Annie is designed to:
- become a uniquely capable, responsible assistant
- reduce friction for non-technical users
- improve Vorster's leverage, speed, and profitability
- grow toward useful internal tools first, then productizable systems later

## Local development

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000`

## Production / service

This project is currently run locally on the host via a systemd transient service.

Use the repo helper to restart it under a stable unit name:

```bash
./scripts/restart-dashboard-service.sh
```

That avoids the common failure mode where `next start` is relaunched manually on port 3000 while the previous transient unit remains in a failed state.

## Important repo files

- `STANDBY.md` — Annie standby-coder operating rules
- `TODO.md` — primary backlog
- `WORKLOG.md` — meaningful progress log

## Verification

```bash
npm run lint
npm run build
```
