import Fuse from "fuse.js";
import { stripAccents, type Med } from "./meds";

// "Losartana Potássica 50 MG" → "losartana potassica 50mg"
function normalize(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/(\d)\s+(mg|mcg|ml|g|ui)\b/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

// Penalize listings that look like clinic/hospital bulk packs or multi-substance
// combinations when the user typed a single substance. Lower is better.
function relevancePenalty(med: Med, query: string): number {
  const apr = med.apresentacao.toUpperCase();
  const q = query.trim();
  const querySpecifiesInjection = /\b(inj|amp|ampola|seringa|ser preenc)/i.test(q);
  const querySpecifiesQuantity = /\d{2,}/.test(q);
  let penalty = 0;

  if (!querySpecifiesInjection) {
    const ampMatch = apr.match(/(\d+)\s*(?:AMP|SER PREENC|SER|FA)\b/);
    if (ampMatch) {
      const qty = parseInt(ampMatch[1]);
      if (qty >= 50) penalty += 0.5;
      else if (qty >= 10) penalty += 0.25;
    }
  }

  if (!querySpecifiesQuantity) {
    const tail = apr.match(/X\s*(\d+)\s*(?:\(EMB HOSP\))?\s*$/);
    if (tail) {
      const qty = parseInt(tail[1]);
      if (qty >= 200) penalty += 0.4;
      else if (qty >= 100) penalty += 0.2;
      else if (qty >= 60) penalty += 0.1;
    }
  }

  if (/EMB HOSP/.test(apr)) penalty += 0.3;
  if (med.hospitalar) penalty += 0.2;

  // Searched by substance ("losartana"): the plain drug before its combinations.
  // Searching a brand of a combination ("dorflex") doesn't hit the substance.
  const qNorm = normalize(q);
  if (
    !/[\s+]/.test(qNorm) &&
    med.substancia.includes("+") &&
    normalize(med.substancia).includes(qNorm)
  ) {
    penalty += 0.2;
  }

  return penalty;
}

export interface SearchIndex {
  meds: Med[];
  names: string[];
  substances: string[];
  haystacks: string[];
  fuse: Fuse<Med> | null;
}

export function createSearchIndex(meds: Med[]): SearchIndex {
  const names = meds.map((m) => normalize(m.produto));
  const substances = meds.map((m) => normalize(m.substancia));
  const haystacks = meds.map(
    (m, i) => `${names[i]} ${substances[i]} ${normalize(m.laboratorio)} ${normalize(m.apresentacao)}`
  );
  return { meds, names, substances, haystacks, fuse: null };
}

export interface SearchResult {
  results: Med[];
  /** No exact match — these are typo-tolerant guesses */
  aproximado: boolean;
}

function matchScore(token: string, name: string, substance: string): number {
  if (name.startsWith(token)) return 0;
  if (substance.startsWith(token)) return 0.05;
  const wordStart = new RegExp(`(^|[ +/(-])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  if (wordStart.test(name) || wordStart.test(substance)) return 0.1;
  if (name.includes(token) || substance.includes(token)) return 0.2;
  return 0.3; // only in the laboratory or the presentation
}

/**
 * Every medicine containing all the words typed (accents ignored), best first.
 * Falls back to fuzzy matching only when nothing matches exactly, so counts
 * mean what they say ("losartana" doesn't pull in olmesartana).
 */
export function searchMeds(index: SearchIndex, query: string): SearchResult {
  const q = normalize(query);
  if (q.length < 2) return { results: [], aproximado: false };
  const tokens = q.split(/[\s+]+/).filter(Boolean);

  const exact: { item: Med; score: number }[] = [];
  index.haystacks.forEach((hay, i) => {
    if (tokens.every((t) => hay.includes(t))) {
      const item = index.meds[i];
      exact.push({
        item,
        score: matchScore(tokens[0], index.names[i], index.substances[i]) + relevancePenalty(item, query),
      });
    }
  });
  if (exact.length > 0) {
    return {
      results: exact.sort((a, b) => a.score - b.score).map((r) => r.item),
      aproximado: false,
    };
  }

  index.fuse ??= new Fuse(index.meds, {
    keys: [
      { name: "produto", weight: 3 },
      { name: "substancia", weight: 2 },
      { name: "laboratorio", weight: 1 },
    ],
    threshold: 0.3,
    ignoreDiacritics: true,
    includeScore: true,
    minMatchCharLength: 2,
  });
  const fuzzy = index.fuse
    .search(query.trim(), { limit: 200 })
    .map((h) => ({ item: h.item, score: (h.score ?? 0) + relevancePenalty(h.item, query) }))
    .sort((a, b) => a.score - b.score)
    .map((r) => r.item);
  return { results: fuzzy, aproximado: fuzzy.length > 0 };
}
