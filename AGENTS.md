# AGENTS.md

## Project

Daily Tracker — a gamified habit tracker. Svelte + Vite + TypeScript + Tailwind, `localStorage` only, no backend for this phase. Read `PRD.md`, `design.md`, and `tasks.md` at the repo root before writing any code — they are the source of truth for mechanics, data model, and UI.

## Workflow

GitHub issues are created manually, one per checklist line in `tasks.md` (see `create-issues.sh` for how they were generated). Never create, edit, or close an issue yourself — an issue closes only via "Closes #N" in a PR description. Your job is to execute existing issues, not to manage the backlog.

- One issue = one unit of work = one branch = one PR. Never combine multiple issues into one PR.
- Work on exactly one issue at a time: the number given in the prompt, or the lowest-numbered open issue if none is specified.
- A Milestone heading in `tasks.md` is an ordering label, not a unit of work. Never treat a whole milestone as one PR, even if several of its issues are mentioned together in one message.
- Check out the branch per the naming convention in the issue body, implement only that issue's scope, run lint and tests, commit using Conventional Commits referencing the issue number, open a PR with "Closes #N".
- Once one PR is opened, stop. Do not move on to another issue automatically — wait for the next instruction.
- If an issue's scope turns out to require touching code outside it, stop and report back instead of expanding scope silently.

## Commands

To be filled in once Milestone 1 (project setup) is merged. Expected, pending confirmation once scaffolded:

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm run test`

## Code style

- TypeScript, strict mode.
- Business logic (level, rank, points, penalties, rank-up gate) lives in `engine/` as plain, framework-free functions — keep it that way so it stays unit-testable without mounting a Svelte component.
- Tailwind for styling. Use the design tokens in `design.md` (colors, rank accents, typography) rather than inventing new ad hoc values.
- No backend, no API calls, no auth — all persistence goes through the `localStorage` helpers in the data layer (Milestone 2). Flag it instead of adding a server dependency if a task seems to need one.
