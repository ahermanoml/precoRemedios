"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Fuse from "fuse.js";

interface Med {
  id: number;
  substancia: string;
  laboratorio: string;
  produto: string;
  apresentacao: string;
  classeTerapeutica: string;
  tipo: string;
  regime: string;
  ean: string;
  tarja: string;
  restricaoHospitalar: string;
  pmc: Record<string, number>;
}

const POPULAR_SEARCHES = [
  "Dipirona",
  "Paracetamol",
  "Ibuprofeno",
  "Amoxicilina",
  "Losartana",
  "Omeprazol",
  "Rivotril",
  "Dorflex",
];

// Translate ANVISA abbreviations to human-readable Portuguese
const FORM_MAP: Record<string, string> = {
  "COM": "Comprimido",
  "COM REV": "Comprimido revestido",
  "COM EFEV": "Comprimido efervescente",
  "COM MAST": "Comprimido mastigável",
  "CAP": "Cápsula",
  "CAP DURA": "Cápsula dura",
  "CAP GEL DURA": "Cápsula gelatinosa dura",
  "CAP GEL MOL": "Cápsula gelatinosa mole",
  "SOL INJ": "Solução injetável",
  "SOL OR": "Solução oral",
  "SOL OFT": "Solução oftálmica",
  "SOL NAS": "Solução nasal",
  "SOL": "Solução",
  "SUSP OR": "Suspensão oral",
  "SUSP INJ": "Suspensão injetável",
  "SUSP": "Suspensão",
  "PO SOL INJ": "Pó para solução injetável",
  "PO SUSP OR": "Pó para suspensão oral",
  "PO": "Pó",
  "CREM DERM": "Creme dermatológico",
  "CREM VAG": "Creme vaginal",
  "CREM": "Creme",
  "GEL OR": "Gel oral",
  "GEL DERM": "Gel dermatológico",
  "GEL": "Gel",
  "POM OFT": "Pomada oftálmica",
  "POM": "Pomada",
  "XPE": "Xarope",
  "AER": "Aerossol",
  "SOL AER": "Solução aerossol",
  "GRAN": "Granulado",
  "DRG": "Drágea",
  "SUP": "Supositório",
  "SOL TOP": "Solução tópica",
  "EMU": "Emulsão",
  "LOC": "Loção",
  "IMPL": "Implante",
  "ADESIVO TRANSD": "Adesivo transdérmico",
  "ESMALTE": "Esmalte",
};

const CONTAINER_MAP: Record<string, string> = {
  "AMP": "ampola",
  "BG": "bisnaga",
  "BL": "blíster",
  "ENV": "envelope",
  "FR": "frasco",
  "FA": "frasco-ampola",
  "SER PREENC": "seringa preenchida",
  "SER": "seringa",
  "TB": "tubo",
  "CT": "caixa com",
  "SAC": "sachê",
  "STRIP": "strip",
  "CAN": "caneta",
  "CAR": "cartucho",
  "FLA": "flaconete",
  "COP": "copo dosador",
  "GOT": "conta-gotas",
  "COL": "colher dosadora",
};

function parseApresentacao(raw: string): {
  concentracao: string;
  forma: string;
  embalagem: string;
} {
  const s = raw.trim();

  // Extract concentration (at the start, e.g. "500 MG/ML" or "10 MG/G + 0,443 MG/G")
  const concMatch = s.match(
    /^([\d,.]+\s*(?:MG|MCG|G|ML|UI|%|ME)(?:\/(?:ML|G|L|DOSE|INAL|H|DIA))?(?:\s*\+\s*[\d,.]+\s*(?:MG|MCG|G|ML|UI|%|ME)(?:\/(?:ML|G|L|DOSE|INAL|H|DIA))?)*)/i
  );
  const concentracao = concMatch ? concMatch[1].trim() : "";
  const rest = concMatch ? s.slice(concMatch[0].length).trim() : s;

  // Try to find the pharmaceutical form
  let forma = "";
  let afterForm = rest;
  // Sort by length desc so we match longer forms first
  const sortedForms = Object.entries(FORM_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [abbr, name] of sortedForms) {
    const idx = afterForm.toUpperCase().indexOf(abbr);
    if (idx !== -1) {
      // Check it's a word boundary
      const before = idx === 0 || /\s/.test(afterForm[idx - 1]);
      const afterChar = afterForm[idx + abbr.length];
      const after = !afterChar || /\s/.test(afterChar);
      if (before && after) {
        forma = name;
        afterForm = (
          afterForm.slice(0, idx) + afterForm.slice(idx + abbr.length)
        ).trim();
        break;
      }
    }
  }

  // Parse the packaging/quantity from what remains
  let embalagem = "";

  const upper = afterForm.toUpperCase();

  // Pattern 1: quantity of containers with volume
  const m1 = upper.match(
    /(\d+)\s*(AMP|SER PREENC|SER|FA|ENV|SAC|FLA|CAN|CAR)\b.*?X\s*([\d,.]+)\s*(ML|G|MG|L|DOSES?)/i
  );
  if (m1) {
    const qty = m1[1];
    const container = CONTAINER_MAP[m1[2]] || m1[2].toLowerCase();
    const vol = m1[3].replace(",", ",");
    const unit = m1[4];
    embalagem = `${qty} ${container}${parseInt(qty) > 1 ? "s" : ""} de ${vol} ${unit.toLowerCase()}`;
  }

  if (!embalagem) {
    // Pattern: "FR ... X 120 ML" -> frasco de 120 mL
    const m2 = upper.match(
      /(?:FR|TB|BG)\b.*?X\s*([\d,.]+)\s*(ML|G|MG|L)/i
    );
    if (m2) {
      const containerMatch = upper.match(/(FR|TB|BG)\b/);
      const container = containerMatch
        ? CONTAINER_MAP[containerMatch[1]] || containerMatch[1].toLowerCase()
        : "frasco";
      embalagem = `${container} de ${m2[1].replace(",", ",")} ${m2[2].toLowerCase()}`;

      if (/\+\s*COP/.test(upper)) embalagem += " + copo dosador";
      if (/GOT/.test(upper)) embalagem = embalagem.replace("frasco", "frasco conta-gotas");
      if (/\+\s*COL/.test(upper)) embalagem += " + colher dosadora";
    }
  }

  if (!embalagem) {
    // Pattern: blíster X 30 -> 30 unidades
    const m3 = upper.match(/X\s*(\d+)\s*$/);
    if (m3) {
      const qty = m3[1];
      const unit = forma.toLowerCase().includes("cápsula")
        ? "cápsula"
        : forma.toLowerCase().includes("comprimido")
          ? "comprimido"
          : forma.toLowerCase().includes("drágea")
            ? "drágea"
            : "unidade";
      embalagem = `${qty} ${unit}${parseInt(qty) > 1 ? "s" : ""}`;
    }
  }

  if (!embalagem) {
    embalagem = afterForm
      .replace(/CT\b/g, "")
      .replace(/BL\b/g, "")
      .replace(/AL\b/g, "")
      .replace(/PLAS\b/g, "")
      .replace(/PEAD\b/g, "")
      .replace(/OPC\b/g, "")
      .replace(/VD\b/g, "")
      .replace(/AMB\b/g, "")
      .replace(/TRANS\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return { concentracao, forma, embalagem };
}

function buildCardTitle(produto: string, parsed: ReturnType<typeof parseApresentacao>): string {
  const parts: string[] = [produto];
  if (parsed.concentracao) {
    parts.push(parsed.concentracao.replace(/\s+/g, ""));
  }
  let suffix = "";
  if (parsed.embalagem) {
    // Capitalize first letter
    suffix = parsed.embalagem.charAt(0).toUpperCase() + parsed.embalagem.slice(1);
  } else if (parsed.forma) {
    suffix = parsed.forma;
  }
  if (suffix) {
    return `${parts.join(" ")} — ${suffix}`;
  }
  return parts.join(" ");
}

const ICMS_STATES: Record<string, string> = {
  "0%": "Isentos de ICMS",
  "12%": "MG, PR, SC, RS",
  "17%": "AC, AL, AM, AP, BA, CE, DF, ES, GO, MA, MT, MS, PA, PB, PE, PI, RR, SE, TO",
  "18%": "PR, SP",
  "19%": "RJ",
  "20%": "MG, RN",
  "21%": "BA, RJ",
  "22%": "RJ",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function TipoBadge({ tipo }: { tipo: string }) {
  const config: Record<string, { classes: string; label: string }> = {
    "Genérico": {
      classes: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
      label: "Genérico",
    },
    "Similar": {
      classes: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
      label: "Similar",
    },
    "Novo": {
      classes: "bg-sky-600/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400",
      label: "Referência",
    },
    "Biológico": {
      classes: "bg-violet-600/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-400",
      label: "Biológico",
    },
  };
  const c = config[tipo] || {
    classes: "bg-foreground/5 text-muted",
    label: tipo,
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${c.classes}`}
    >
      {c.label}
    </span>
  );
}

function TarjaIndicator({ tarja }: { tarja: string }) {
  if (!tarja) return null;
  const lower = tarja.toLowerCase();
  if (lower.includes("preta")) {
    return (
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-gray-900 dark:bg-gray-200" />
    );
  }
  if (lower.includes("vermelha")) {
    return (
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-red-500" />
    );
  }
  return null;
}

function MedCard({
  med,
  expanded,
  onToggle,
  index,
}: {
  med: Med;
  expanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const mainPrice = med.pmc["18%"] || med.pmc["17%"] || med.pmc["0%"];
  const parsed = parseApresentacao(med.apresentacao);
  const cardTitle = buildCardTitle(med.produto, parsed);
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "stagger-10";

  return (
    <div
      className={`animate-fade-in-up ${staggerClass} group relative rounded-xl border border-border bg-surface transition-all duration-200 hover:border-accent/30 hover:shadow-[0_2px_20px_-4px_rgba(13,107,88,0.1)] dark:hover:shadow-[0_2px_20px_-4px_rgba(52,213,168,0.08)]`}
    >
      <TarjaIndicator tarja={med.tarja} />

      <button
        onClick={onToggle}
        className="w-full text-left p-5 pl-6"
        aria-expanded={expanded}
      >
        {/* Title line: product + concentration + packaging + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-[15px] font-semibold text-foreground leading-tight">
                {cardTitle}
              </h3>
              <TipoBadge tipo={med.tipo} />
            </div>
            {/* Substance + forma */}
            <p className="mt-1.5 text-[13px] text-muted leading-snug">
              {med.substancia.toLowerCase().replace(/(^|\b)\w/g, (c) => c.toUpperCase())}
              {parsed.forma && (
                <span className="text-muted-light"> · {parsed.forma}</span>
              )}
            </p>
          </div>

          {/* Expand indicator */}
          <svg
            className={`h-4 w-4 shrink-0 text-muted-light mt-0.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Price + lab row */}
        <div className="mt-3.5 flex items-end justify-between gap-4">
          <span className="text-[11px] text-muted-light tracking-wide uppercase truncate">
            {med.laboratorio}
          </span>
          {mainPrice && (
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-[10px] font-medium text-muted-light uppercase tracking-widest">
                PMC
              </span>
              <span className="text-xl font-bold text-foreground tabular-nums tracking-tight font-sans">
                {formatCurrency(mainPrice)}
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="animate-expand-down border-t border-border-subtle px-5 pl-6 pb-5 pt-4">
          {/* Info banner */}
          <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-accent-light/60 border border-accent/10 px-3.5 py-2.5">
            <svg className="h-4 w-4 shrink-0 mt-0.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-xs text-accent-dark leading-relaxed dark:text-accent">
              Preços máximos que farmácias podem cobrar, definidos pela CMED/ANVISA. O valor varia conforme a alíquota de ICMS do seu estado.
            </p>
          </div>

          <h4 className="mb-3 text-[10px] font-bold text-muted-light uppercase tracking-[0.1em]">
            Preço máximo por alíquota
          </h4>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {Object.entries(med.pmc).map(([rate, price]) => {
              const isHighlighted = rate === "18%";
              return (
                <div
                  key={rate}
                  className={`rounded-lg p-2.5 text-center transition-colors ${
                    isHighlighted
                      ? "bg-accent-light border border-accent/15"
                      : "bg-foreground/[0.02] dark:bg-foreground/[0.04]"
                  }`}
                >
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${isHighlighted ? "text-accent" : "text-muted-light"}`}>
                    ICMS {rate}
                  </p>
                  <p className={`mt-0.5 text-sm font-bold tabular-nums ${isHighlighted ? "text-accent-dark dark:text-accent" : "text-foreground"}`}>
                    {formatCurrency(price)}
                  </p>
                  <p className="mt-0.5 text-[9px] text-muted-light leading-tight">
                    {ICMS_STATES[rate] || ""}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            {med.ean && med.ean !== "-" && (
              <span className="font-mono text-muted-light">EAN {med.ean}</span>
            )}
            <span>{med.classeTerapeutica}</span>
            {med.restricaoHospitalar === "Sim" && (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Uso hospitalar
              </span>
            )}
          </div>

          <p className="mt-2 text-[10px] text-muted-light/60 font-mono tracking-tight">
            {med.apresentacao}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Med[]>([]);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fuseRef = useRef<Fuse<Med> | null>(null);

  useEffect(() => {
    fetch("/data/meds.json")
      .then((res) => res.json())
      .then((data: Med[]) => {
        fuseRef.current = new Fuse(data, {
          keys: [
            { name: "produto", weight: 3 },
            { name: "substancia", weight: 2 },
            { name: "laboratorio", weight: 1 },
          ],
          threshold: 0.3,
        });
        setDataLoading(false);
      })
      .catch(() => {
        setDataLoading(false);
      });
  }, []);

  const search = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearched(true);

    if (!fuseRef.current) {
      setResults([]);
      return;
    }

    const hits = fuseRef.current.search(q, { limit: 30 });
    setResults(hits.map((h) => h.item));
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 150);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.03] via-transparent to-accent/[0.02]" />
        <div className="relative mx-auto max-w-2xl px-5 pt-14 pb-10">
          <div className="flex items-center gap-3">
            {/* Pharmacy cross icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 2a1 1 0 00-1 1v4H3a1 1 0 00-1 1v4a1 1 0 001 1h4v4a1 1 0 001 1h4a1 1 0 001-1v-4h4a1 1 0 001-1V8a1 1 0 00-1-1h-4V3a1 1 0 00-1-1H8z" />
              </svg>
            </div>
            <h1 className="font-serif text-3xl text-foreground tracking-tight">
              MedPreço
            </h1>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-muted max-w-lg">
            Consulte o{" "}
            <strong className="font-semibold text-foreground">preço máximo</strong>{" "}
            que farmácias podem cobrar por medicamentos no Brasil, segundo a ANVISA/CMED.
          </p>
        </div>
      </header>

      {/* Sticky search bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-5 py-3">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-light"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Buscar medicamento, princípio ativo ou laboratório..."
              className="w-full rounded-xl border border-border bg-surface py-3.5 pl-11 pr-12 text-[15px] text-foreground shadow-sm outline-none transition-all duration-200 placeholder:text-muted-light focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(13,107,88,0.08)] dark:focus:shadow-[0_0_0_3px_rgba(52,213,168,0.08)]"
              autoFocus
            />
            {dataLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-5 w-5 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="mx-auto max-w-2xl px-5 py-6">
        {/* Loading data */}
        {dataLoading && (
          <div className="py-24 text-center animate-fade-in-up">
            <div className="mx-auto mb-4 h-8 w-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <p className="text-sm text-muted">Carregando medicamentos...</p>
          </div>
        )}

        {/* No results */}
        {!dataLoading && searched && results.length === 0 && (
          <div className="py-16 text-center animate-fade-in-up">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5">
              <svg className="h-5 w-5 text-muted-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
              </svg>
            </div>
            <p className="text-[15px] font-medium text-foreground">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Tente outro nome ou princípio ativo
            </p>
          </div>
        )}

        {/* Results list */}
        {!dataLoading && results.length > 0 && (
          <>
            <p className="mb-4 text-[11px] font-medium text-muted-light uppercase tracking-widest">
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-2.5">
              {results.map((med, i) => (
                <MedCard
                  key={med.id}
                  med={med}
                  expanded={expandedId === med.id}
                  onToggle={() =>
                    setExpandedId(expandedId === med.id ? null : med.id)
                  }
                  index={i}
                />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!dataLoading && !searched && (
          <div className="py-24 text-center animate-fade-in-up">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent-light">
              <svg
                className="h-9 w-9 text-accent animate-subtle-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <p className="text-base text-muted">
              Busque entre{" "}
              <strong className="font-semibold text-foreground">23 mil</strong>{" "}
              medicamentos
            </p>
            <p className="mt-1.5 text-sm text-muted-light">
              por nome, princípio ativo ou laboratório
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => handleInput(term)}
                  className="rounded-full border border-border-subtle bg-foreground/[0.03] px-3 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:bg-accent-light hover:text-accent dark:bg-foreground/[0.05]"
                >
                  {term}
                </button>
              ))}
            </div>
            <div className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.03] px-3 py-1 text-[10px] text-muted-light dark:bg-foreground/[0.05]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent/60" />
              Fonte: CMED/ANVISA &middot; Atualizado em fev/2026
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border-subtle py-8">
        <div className="mx-auto max-w-2xl px-5 text-center text-xs leading-relaxed text-muted-light">
          <p>
            Os preços exibidos são os <strong className="font-medium text-muted">preços máximos ao consumidor</strong> (PMC)
            definidos pela{" "}
            <a
              href="https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos"
              className="underline underline-offset-2 decoration-muted-light/30 hover:text-accent hover:decoration-accent/30 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              CMED/ANVISA
            </a>
            . Farmácias podem cobrar valores menores.
          </p>
          <p className="mt-1.5">
            Este site não substitui orientação médica ou farmacêutica.
          </p>
        </div>
      </footer>
    </div>
  );
}
