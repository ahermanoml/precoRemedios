# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedPreço (medpreco.com) is a Next.js application for searching Brazilian medication prices (PMC - Preço Máximo ao Consumidor) regulated by ANVISA/CMED. It serves ~22,000 retail presentations from the official CMED price list.

## Commands

- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — ESLint
- `node scripts/fetch-cmed.mjs` — Download the latest CMED list to `scripts/pmc_raw.xlsx` (gitignored)
- `node scripts/parse-prices.mjs` — Regenerate `public/data/meds.json` + `src/data/cmed-meta.json` from it

`.github/workflows/atualiza-cmed.yml` runs fetch + parse every Monday and commits to `main` when the list changed (that commit triggers the Vercel deploy). Run it by hand from the Actions tab after a CMED publication.

## Architecture

### Data Pipeline

```
CMED page (gov.br) → scripts/fetch-cmed.mjs → scripts/pmc_raw.xlsx
  → scripts/parse-prices.mjs
  → public/data/meds.json (compact: string tables + one row array per med, 13 ICMS rates)
  → src/data/cmed-meta.json (publication date, shown in the footer/titles)
```

The parser finds the header row in any sheet (the CMED changed the layout in 2026), refuses to write if it parses fewer than 15k meds, normalizes accent variants of the same substance and title-cases substance names. Products without PMC (hospital-only) are dropped.

### Key Files

- `src/lib/meds.ts` — `Med` type, `decodeMeds()` for the compact JSON, `parseApresentacao()` (FORM_MAP, CONTAINER_MAP, unit count for per-tablet prices), grouping key, price helpers. **Single definition of the data shape** — change it together with `parse-prices.mjs`.
- `src/lib/icms.ts` — UF → ICMS rate for medicines (which PMC column applies), incl. genéricos at 12% in MG/SP. Review when a state changes its rate.
- `src/lib/farmacia-popular.ts` — free items of the Farmácia Popular (Portaria GM/MS 12.091/2026), matched by substance + strength + form.
- `src/lib/search.ts` — accent-insensitive exact search (all words must match) ranked by relevance; Fuse.js fuzzy fallback only when nothing matches. Used by the home and `/api/search`.
- `src/lib/meds-client.ts` / `meds-server.ts` — load the data in the browser (fetched on first search intent) / on the server (JSON import, bundled by Vercel).
- `src/lib/preferences.ts` — localStorage stores: chosen UF (`medpreco-uf`) and favorites (`medpreco-favoritos`, CMED GGREM codes).
- `src/components/HomeSearch.tsx` — home search; keeps `?q=` in the URL.
- `src/components/MedResults.tsx` — grouped results (substance + strength + form), UF picker, sort by unit/box price, generic-vs-reference savings, details panel, favorites button.
- `src/app/medicamento/[slug]/page.tsx` — one SEO page per substance, rendered on first visit and cached; listed in `sitemap.ts`. Per-page OG image next to it.

## Tech Stack

- Next.js 16 with App Router, React 19, TypeScript (strict mode)
- Tailwind CSS 4, dark theme (tokens in `globals.css`)
- Fuse.js (fuzzy fallback), xlsx for Excel parsing, Vercel Analytics
- Path alias: `@/*` → `./src/*`

## Language

All user-facing content is in Portuguese (pt-BR). ANVISA pharmaceutical abbreviations (COM, CAP, SOL INJ, etc.) are mapped to full Portuguese names in `src/lib/meds.ts`.
