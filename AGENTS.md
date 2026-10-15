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
- If the same command fails after two fix attempts, stop and report the exact error. Do not keep retrying.
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

## UI Fidelity Contract (UI Revamp milestone)

### Source of truth

- `docs/prototype/*.html` is the visual and interaction spec. For anything visual (layout, spacing, color, type, motion, copy, ARIA), the prototype beats `design.md` and any other description.
- `docs/PRD.md` still wins for behavior and rules (points, rank, gate, penalties, validation). The prototypes use simplified demo logic. If a prototype and the PRD disagree on behavior, follow the PRD and log it in `docs/prototype/DEVIATIONS.md`. Never resolve a conflict silently.
- Never edit files in `docs/prototype/`.

### Scope

- UI only. Do not change the engine (`src/lib/engine/**`) or its tests, except to expose already-computed values.
- No new dependencies except `@fontsource/chakra-petch`, `@fontsource/manrope`, `@fontsource/jetbrains-mono`, and dev-only `pixelmatch` and `pngjs`. Ask before adding anything else.

### Port rules (these are what make the result identical)

1. **Tokens:** copy the `:root` block (and `[data-theme=light]` from settings.html) verbatim into `src/app.css`. Keep the custom property names exactly (`--blue`, `--panel`, `--ease`, `--t-base`, ...).
2. **CSS:** copy declarations verbatim. Do not "clean up", reorder values, convert px to rem, merge rules, rename classes, or replace rules with utility classes. Keep `@property --arm`, every `@keyframes`, and the media queries (1100px, 700px, `prefers-reduced-motion`, `[data-motion=off]`).
3. **Where the CSS lives:** global stylesheets (`src/styles/ui/*.css`) imported once. Do not use Svelte scoped `<style>` for ported rules, because scoping rewrites selectors and breaks `::before`/`::after` and cross-component class selectors.
4. **DOM:** same elements, same order, same class names, same attributes (`role`, `aria-*`, `tabindex`, `data-*`), same copy text (Indonesian, as written). Component boundaries are free, but the rendered DOM must be identical.
5. **Fonts:** Chakra Petch 500/600/700, Manrope 400/500/700, JetBrains Mono 500 via `@fontsource` (latin subset). Remove the Google Fonts `<link>`. Keep the same fallback stacks.
6. **Behavior vs demo logic:** the prototype's inline JS contains demo logic (`award()`, `lvOf()`, `gate()`, the History simulation, hardcoded `CAP`, `MULT`, `AVG`, `thr`). Never copy that as business logic. Read every value from the engine or store. Copy only the UI mechanics: tweening, floating numbers, ring/coin bursts, drawer open/close, focus management, undo toasts, keyboard handling.
7. **Motion:** reproduce every animation with the same durations, easing, delays, and stagger (`--i`). Honor `prefers-reduced-motion` and `data-motion="off"` exactly as the prototypes do. Particle canvas: same count, speed, and pause-on-hidden behavior.
8. **Allowed deviations:** only those written in `docs/prototype/DEVIATIONS.md` (reason + which PRD rule). Any other difference is a bug.

### Done means (per page)

- `npm run test:visual` passes for that page at 1280×800 and 390×844 (pixel diff + computed-style diff, see `docs/UI-REVAMP.md` §3).
- Interaction checklist in the page's issue is fully ticked and manually verified.
- No console errors or warnings; `npm run check`, `npm run lint`, `npm test`, `npm run build` all pass.
- Keyboard-only and `prefers-reduced-motion` verified.
- A short report is added to the PR: diff ratios, deviations (if any), anything uncertain.

### When unsure

Stop and ask. Do not guess a value, redesign a component, or "improve" the prototype.
