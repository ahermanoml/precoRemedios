# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedPreço is a Next.js application for searching Brazilian medication prices (PMC - Preço Máximo ao Consumidor) regulated by ANVISA/CMED. It serves ~23,000 medications from an official CMED Excel spreadsheet.

## Commands

- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — ESLint
- `node scripts/parse-prices.mjs` — Regenerate `public/data/meds.json` from `scripts/pmc_raw.xlsx`

## Architecture

### Data Pipeline

```
scripts/pmc_raw.xlsx (ANVISA official spreadsheet)
  → node scripts/parse-prices.mjs
  → public/data/meds.json (23k medicines, ~11MB)
  → /api/search endpoint (Fuse.js fuzzy search, lazy-cached index)
  → page.tsx (client-side debounced search, 300ms)
```

### Key Files

- `src/app/page.tsx` — Single-page client component with all UI: search input, result cards, presentation parsing (FORM_MAP, CONTAINER_MAP, parseApresentacao), ICMS state mappings, TipoBadge and MedCard components. Everything lives in this one file.
- `src/app/api/search/route.ts` — GET `/api/search?q=<query>&limit=30`. Fuse.js with weighted keys: produto (3), substancia (2), laboratorio (1). Threshold 0.3, max limit 100, min query length 2.
- `scripts/parse-prices.mjs` — Parses ANVISA Excel into JSON. Maps PMC prices across 8 ICMS rates (0%, 12%, 17%-22%).
- `src/app/layout.tsx` — Root layout with Geist font, `lang="pt-BR"`, metadata.

### Med Interface (duplicated in page.tsx and route.ts)

The `Med` type is defined independently in both the client page and the API route. If you change the data shape, update both locations.

### Search

Fuse.js fuzzy search runs server-side. The index is built lazily on first request and cached in module scope. Client debounces input by 300ms before calling the API.

## Tech Stack

- Next.js 16 with App Router, React 19, TypeScript (strict mode)
- Tailwind CSS 4 for styling, dark mode via `prefers-color-scheme`
- Fuse.js for fuzzy search, xlsx for Excel parsing
- Path alias: `@/*` → `./src/*`

## Language

All user-facing content is in Portuguese (pt-BR). ANVISA pharmaceutical abbreviations (COM, CAP, SOL INJ, etc.) are mapped to full Portuguese names in page.tsx.
