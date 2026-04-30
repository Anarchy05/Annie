# Mission Control Release Checklist

Use this before shipping dashboard-facing changes.

## Quick preflight

- [ ] `git status --short` only shows intentional changes.
- [ ] New routes, pages, and components were checked for missing/empty/error states.
- [ ] Local state dependencies degrade safely when OpenClaw data is missing or partial.

## Verification

- [ ] Run the smallest meaningful check for the change (`npm run lint`, `npm run build`, or a focused manual smoke test).
- [ ] Visit the changed page or route when practical.
- [ ] Confirm loading, success, and failure states still look sane.

## Ship

- [ ] Update `TODO.md` if backlog items were completed or new follow-up work was discovered.
- [ ] Add a short `WORKLOG.md` entry for meaningful progress.
- [ ] Use a small clear commit message.
- [ ] Push only after the app is still working.
