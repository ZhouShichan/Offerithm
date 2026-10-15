# AGENTS.md

Offerithm (薪筹) — local-first web app for mainland-China new-grad salary analysis and multi-offer comparison. No backend, no login; all user data lives in browser IndexedDB. Stack: Vite 5 + React 18 + TypeScript 5 (strict) + Tailwind CSS 4 + react-router-dom 6; Vitest for tests.

## Commands

```bash
npm run dev          # dev server
npm run typecheck    # tsc -b --noEmit (run before every commit)
npm run lint         # eslint .
npm test             # vitest run — node env, only src/**/*.test.ts
npm run test:watch   # vitest in watch mode
npm run build        # tsc -b && vite build
```

CI (`.github/workflows/ci.yml`, Node 20) runs typecheck → lint → test → build on every PR and push to `main`. All four must pass.

## Architecture boundaries (enforced by convention, see CONTRIBUTING.md)

- `src/core/` — domain types and calculation engine. **Pure functions only: no React imports, no DOM, no IndexedDB.** Engine modules: `salary` / `insurance` / `tax` / `compare`; entry point `calculateOffer` in `src/core/engine/index.ts`.
- `src/core/types.ts` — the single contract shared between engine and UI.
- `src/policies/` — all policy parameters (tax tables, insurance/HF rates, base floors/ceilings). Engines receive policy objects as arguments; **never hardcode policy numbers in calculation logic**. Every policy datum must carry a `source`; unverifiable numbers must not be shipped.
- `src/storage/` — IndexedDB wrapper and JSON/CSV import-export.
- `src/pages/` + `src/App.tsx` — UI pages (Home / Offers / Compare / Settings) and routing.

## Honesty principle (诚信原则) — non-negotiable

Unknown data must never be presented as certain. Estimates use `Uncertain<T>` (`{ value, confidence, note? }`) from `src/core/types.ts`; keep unknown fields `undefined` or `confidence < 1`. Built-in region policies are sample configs, not authoritative.

## Conventions

- TypeScript strict; `no-explicit-any` is an ESLint **error**; no non-null assertions (tests excepted). Prefer `import type` (`consistent-type-imports`).
- Money is `number` in yuan (元); rates are decimals (0.08 = 8%). Never mix units.
- Dates are ISO 8601 strings.
- React: function components + hooks; keep state as local as possible.
- New engine logic requires Vitest tests (`*.test.ts` under `__tests__/`). Assertions involving tax/rates must include the derivation as comments. Policy-data changes require an official source link in the PR description.
- Commit messages: Chinese or English imperative mood, one logical change per commit.
- 关键术语在中文文档中后接括注的标准英文词汇，写作「中文术语(English Term)」，如 年终奖(Annual Bonus)；规范英文词汇以根目录 `GLOSSARY.md` 为准。

## Gotchas

- **Vite `base`**: production build uses `/Offerithm/` (GitHub Pages subpath). Override with the `VITE_BASE` env var if deploying under another name — see `vite.config.ts`.
- **Deploy**: pushing to `main` auto-deploys to GitHub Pages via `.github/workflows/deploy.yml`.
- **Tests run in `node` environment** (not jsdom) — no DOM APIs in tests.
- Product behavior questions: `docs/prd.md` is the single source of truth for requirements. Items marked 「待决」/「待设计」 are NOT confirmed requirements — do not implement them as such.

## Read before touching sensitive areas

- `CONTRIBUTING.md` — all dev rules and architecture constraints (source of the rules above).
- `docs/prd.md` — product requirements PRD.
- `src/core/types.ts` + `src/policies/*` — before changing any calculation or policy.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
