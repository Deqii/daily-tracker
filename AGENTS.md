# AGENTS.md

## Project

Daily Tracker is a gamified habit tracker: Svelte 5 (runes) + Vite + TypeScript (strict) + Tailwind CSS v4. All data lives in `localStorage`. No backend, no auth, no API calls in this phase.

Your job is to execute one existing GitHub issue at a time. You do not manage the backlog.

Reply to the human in the language they write (Indonesian or English). Code, comments, commits, PRs, and docs are in English.

## Source of truth

Docs are human-owned and live in `docs/`. Read what the issue needs, not everything.

| Work                 | Read                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| Any issue            | the issue (`gh issue view N`) and its entry in `docs/tasks.md`                       |
| data, engine, stores | `docs/PRD.md` §2 (rules), §6 (data model), §7 (engine spec)                          |
| UI                   | `docs/design.md` §2–4 (tokens, typography, components) and the section for that page |
| A rule seems missing | `docs/decisions.md`                                                                  |

Precedence when docs disagree: `PRD.md` > `decisions.md` > `tasks.md` > `design.md` for mechanics and data; `design.md` wins for visuals and UI copy. If two docs conflict, or a rule is written nowhere, stop and ask. Never guess mechanics (points, penalties, ranks, dates). Sample data in `design.md` is illustrative, not a fixture.

Never edit `docs/`. If a doc is wrong or incomplete, say so in your report.

## Workflow

- Work on exactly one issue: the number given in the prompt. If no number is given, ask. Never pick one yourself.
- One issue = one branch = one PR. Never combine issues. A Milestone heading is an ordering label, not a unit of work.
- Never create, edit, close, comment on, or label an issue. The human creates issues. An issue closes only through `Closes #N` in a merged PR.
- Before starting: `git switch main && git pull --ff-only`. Check that the issues this one depends on are closed (the issue's "Blocked by", or the execution order in `docs/tasks.md`). If not, stop and report. If the issue already has an open PR or a branch, stop and report.
- Branch: `<type>/<N>-<short-kebab-description>`, for example `feat/13-daily-rotation`. `<type>` is the Conventional Commit type of the issue title.
- Implement only this issue's scope and acceptance criteria. If you must touch code outside it, stop and report instead of expanding scope.
- Every `feat` and `fix` in `engine/`, `lib/`, or the data layer ships with unit tests for the code it adds (co-located `name.test.ts`). This applies from the first issue after Vitest is installed. Code merged earlier gets its tests from the checkpoint issues and #22.
- Commits: Conventional Commits in English, imperative, subject at most 72 characters: `type(scope): description`. Type and scope come from the issue title. Add the footer `Refs #N`.
- PR: the title equals the issue title (shortened to 72 characters if needed). The body follows `.github/pull_request_template.md` and ends with `Closes #N`. Open it with `gh pr create`. Do not merge.
- After the PR is open, stop. Report in at most 5 lines: what changed, tests added, checks run, assumptions you had to make, anything skipped. Do not start another issue.

Allowed: `git`, `npm run *`, `gh issue view|list`, `gh pr create|view|list`.
Never: `gh issue create|edit|close|comment|delete`, `gh pr merge|close`, `git push --force`, pushing to `main`, `--no-verify`, `git reset --hard` on shared branches.

## Commands

```
npm ci                # install from the lockfile
npm run dev           # Vite dev server
npm run build         # production build
npm run lint          # ESLint
npm run format        # Prettier --write
npm run check         # svelte-check (types and a11y warnings)
npm run test          # Vitest, single run (not watch)
```

Definition of done: `lint`, `check`, `test`, and `build` all pass. If a script does not exist yet, say so in the PR. Do not skip it silently and do not invent it.

## Code rules

- TypeScript strict. No `any`, no unexplained `!`, exhaustive `switch` on unions.
- Svelte 5 runes only: `$props`, `$state`, `$derived`, `$effect`, snippets, `onclick`. Never `export let`, `$:`, `<slot>`, `createEventDispatcher`, or `on:click`. App-level state uses Svelte stores in `stores/` (PRD §5). Local component state uses runes.
- `engine/` is pure: plain functions, no Svelte, no DOM, no `localStorage`, no `Date.now()`, `new Date()`, or `Math.random()`. Time (`now`, `today`) and seeds are parameters. Return new objects; never mutate inputs.
- Dates: a local day is `YYYY-MM-DD` built with `lib/date.ts`. Never use `toISOString()` for a local day. Timestamps are ISO 8601 with a UTC offset.
- Persistence goes only through `lib/storage`. Handle write failures (PRD §2.2).
- Styling: Tailwind v4. Colors, glow, and fonts come from the tokens in `docs/design.md` §2 (CSS variables in `src/app.css`). No hard-coded hex values in components.
- UI text is exactly as written in `docs/design.md`. No emoji. Semantic HTML, visible focus, labels on inputs, `aria-label` on icon-only buttons, respect `prefers-reduced-motion`.
- Charts (radar, line) are in-house SVG. No chart libraries. Routing is hash-based, with no router library.
- Dependencies: do not add or upgrade any dependency. Pre-approved only: `vitest`, `@fontsource-variable/manrope`, `@fontsource-variable/jetbrains-mono`. For anything else, stop and ask.
- Files in kebab-case, Svelte components in PascalCase. No leftover `console.log`, no commented-out code, no TODO without an issue number.

## Repo map

```
src/
  components/   reusable UI
  pages/        Today, Tasks, Rewards, History, Settings
  stores/       Svelte stores persisted through lib/storage
  engine/       pure game logic + tests
  lib/          storage, date helpers, ids, constants
  app.css       Tailwind + design tokens
docs/           PRD.md, decisions.md, design.md, tasks.md, stitch-notes.md (human-owned)
```
