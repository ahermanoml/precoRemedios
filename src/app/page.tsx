"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import Link from "next/link";

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

const POPULAR_SEARCHES = ["Dipirona", "Paracetamol", "Losartana"];

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

  const UNIT = "(?:MUI|MG|MCG|ML|UI|U|ME|G|%)";
  const UNIT_RATIO = `(?:${UNIT}(?:\\/(?:ML|G|L|DOSE|INAL|H|DIA|COM))?)`;
  const NUM = "[\\d][\\d,. ]*[\\d,]|[\\d]";
  const PNUM = "[\\d][\\d,.]*";
  const PAREN_GROUP = `\\(${PNUM}(?:\\s*(?:${UNIT_RATIO})?\\s*\\+\\s*${PNUM})*(?:\\s*${UNIT_RATIO})?\\s*\\)`;
  const VALUE = `(?:(?:${PAREN_GROUP}|${NUM})\\s*${UNIT_RATIO}?)`;
  const CONC_RE = new RegExp(
    `^(${VALUE}(?:\\s*\\+\\s*${VALUE})*)(?:\\/${UNIT})?`,
    "i"
  );
  const concMatch = s.match(CONC_RE);
  const hasUnit = concMatch?.[1] && new RegExp(UNIT, "i").test(concMatch[1]);
  const concentracao = (concMatch && hasUnit) ? concMatch[0].trim() : "";
  const rest = (concMatch && hasUnit) ? s.slice(concMatch[0].length).trim() : s;

  let forma = "";
  let afterForm = rest;
  const sortedForms = Object.entries(FORM_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [abbr, name] of sortedForms) {
    const idx = afterForm.toUpperCase().indexOf(abbr);
    if (idx !== -1) {
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

  let embalagem = "";

  const upper = afterForm.toUpperCase();

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
    suffix = parsed.embalagem.charAt(0).toUpperCase() + parsed.embalagem.slice(1);
  } else if (parsed.forma) {
    suffix = parsed.forma;
  }
  if (suffix) {
    return `${parts.join(" ")} — ${suffix}`;
  }
  return parts.join(" ");
}

function getGroupKey(med: Med): string {
  const parsed = parseApresentacao(med.apresentacao);
  const sub = med.substancia.trim().toUpperCase().replace(/\s+/g, " ");
  const conc = parsed.concentracao.trim().toUpperCase().replace(/\s+/g, "");
  const form = parsed.forma.trim().toUpperCase();
  if (!sub && !conc && !form) return `_${med.id}`;
  return `${sub}|${conc}|${form}`;
}

function priceOf(med: Med): number {
  return med.pmc["18%"] || med.pmc["17%"] || med.pmc["0%"] || Infinity;
}

function groupResults(results: Med[]): Array<{ key: string; meds: Med[] }> {
  const map = new Map<string, Med[]>();
  const order: string[] = [];
  for (const med of results) {
    const key = getGroupKey(med);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(med);
  }
  for (const meds of map.values()) {
    meds.sort((a, b) => priceOf(a) - priceOf(b));
  }
  return order.map((key) => ({ key, meds: map.get(key)! }));
}

const ICMS_STATES: Record<string, string> = {
  "0%": "Isentos de ICMS",
  "12%": "PR, SC, RS",
  "17%": "AC, AL, AM, AP, BA, CE, DF, ES, GO, MA, MT, MS, PA, PB, PE, PI, RR, SE, TO",
  "18%": "MG, PR, SP",
  "19%": "RJ",
  "20%": "RN",
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
      classes: "bg-emerald-400/10 text-emerald-400",
      label: "Genérico",
    },
    "Similar": {
      classes: "bg-amber-400/10 text-amber-400",
      label: "Similar",
    },
    "Novo": {
      classes: "bg-sky-400/10 text-sky-400",
      label: "Referência",
    },
    "Biológico": {
      classes: "bg-violet-400/10 text-violet-400",
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
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-gray-200" />
    );
  }
  if (lower.includes("vermelha")) {
    return (
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-red-500" />
    );
  }
  return null;
}

function MedDetails({ med }: { med: Med }) {
  return (
    <div className="animate-expand-down border-t border-border-subtle px-5 pl-6 pb-5 pt-4">
      <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-accent-light/60 border border-accent/10 px-3.5 py-2.5">
        <svg className="h-4 w-4 shrink-0 mt-0.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-accent leading-relaxed">
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
                  : "bg-foreground/[0.04]"
              }`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isHighlighted ? "text-accent" : "text-muted-light"}`}>
                ICMS {rate}
              </p>
              <p className={`mt-0.5 text-sm font-bold tabular-nums ${isHighlighted ? "text-accent" : "text-foreground"}`}>
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
          <span className="font-semibold text-amber-400">
            Uso hospitalar
          </span>
        )}
      </div>

      <p className="mt-2 text-[10px] text-muted-light/60 font-mono tracking-tight">
        {med.apresentacao}
      </p>
    </div>
  );
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
      className={`animate-fade-in-up ${staggerClass} group relative rounded-xl border border-border bg-surface transition-all duration-200 hover:border-accent/30 hover:shadow-[0_2px_20px_-4px_rgba(52,211,153,0.1)]`}
    >
      <TarjaIndicator tarja={med.tarja} />

      <button
        onClick={onToggle}
        className="w-full text-left p-5 pl-6"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-[15px] font-semibold text-foreground leading-tight">
                {cardTitle}
              </h3>
              <TipoBadge tipo={med.tipo} />
            </div>
            <p className="mt-1.5 text-[13px] text-muted leading-snug">
              {med.substancia.toLowerCase().replace(/(^|\b)\w/g, (c) => c.toUpperCase())}
              {parsed.forma && (
                <span className="text-muted-light"> · {parsed.forma}</span>
              )}
            </p>
          </div>

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

      {expanded && <MedDetails med={med} />}
    </div>
  );
}

function VariantRow({
  med,
  expanded,
  onToggle,
  isFirst,
}: {
  med: Med;
  expanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
}) {
  const parsed = parseApresentacao(med.apresentacao);
  const mainPrice = med.pmc["18%"] || med.pmc["17%"] || med.pmc["0%"];
  const embalagem = parsed.embalagem
    ? parsed.embalagem.charAt(0).toUpperCase() + parsed.embalagem.slice(1)
    : "";

  return (
    <div className={`relative ${!isFirst ? "border-t border-border-subtle" : ""}`}>
      <TarjaIndicator tarja={med.tarja} />
      <button
        onClick={onToggle}
        className="w-full text-left px-5 pl-6 py-3 transition-colors hover:bg-foreground/[0.03]"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-foreground truncate">
                {med.laboratorio}
              </span>
              <TipoBadge tipo={med.tipo} />
            </div>
            {embalagem && (
              <p className="mt-0.5 text-[12px] text-muted-light truncate">
                {embalagem}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mainPrice && (
              <span className="text-[15px] font-bold text-foreground tabular-nums tracking-tight">
                {formatCurrency(mainPrice)}
              </span>
            )}
            <svg
              className={`h-3.5 w-3.5 text-muted-light transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>
      {expanded && <MedDetails med={med} />}
    </div>
  );
}

function GroupCard({
  meds,
  groupExpanded,
  onGroupToggle,
  expandedMedId,
  onMedToggle,
  index,
}: {
  meds: Med[];
  groupExpanded: boolean;
  onGroupToggle: () => void;
  expandedMedId: number | null;
  onMedToggle: (id: number) => void;
  index: number;
}) {
  const cheapest = meds[0];
  const parsed = parseApresentacao(cheapest.apresentacao);
  const cheapestPrice =
    cheapest.pmc["18%"] || cheapest.pmc["17%"] || cheapest.pmc["0%"];
  const substance = cheapest.substancia
    .toLowerCase()
    .replace(/(^|\b)\w/g, (c) => c.toUpperCase());
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "stagger-10";
  const title = parsed.concentracao
    ? `${substance} ${parsed.concentracao.replace(/\s+/g, "")}`
    : substance;

  return (
    <div
      className={`animate-fade-in-up ${staggerClass} group relative rounded-xl border border-border bg-surface transition-all duration-200 ${
        !groupExpanded
          ? "hover:border-accent/30 hover:shadow-[0_2px_20px_-4px_rgba(52,211,153,0.1)]"
          : ""
      }`}
    >
      <button
        onClick={onGroupToggle}
        className="w-full text-left p-5 pl-6"
        aria-expanded={groupExpanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground leading-tight">
              {title}
            </h3>
            <p className="mt-1.5 text-[13px] text-muted leading-snug">
              {parsed.forma || "Apresentações"}
              <span className="text-muted-light">
                {" "}
                · {meds.length} apresentaç{meds.length !== 1 ? "ões" : "ão"}
              </span>
            </p>
          </div>
          <svg
            className={`h-4 w-4 shrink-0 text-muted-light mt-0.5 transition-transform duration-200 ${groupExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="mt-3.5 flex items-end justify-between gap-4">
          <span className="text-[11px] text-muted-light tracking-wide uppercase truncate">
            {meds.length} laboratório{meds.length !== 1 ? "s" : ""}
          </span>
          {cheapestPrice && (
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-[10px] font-medium text-muted-light uppercase tracking-widest">
                a partir de
              </span>
              <span className="text-xl font-bold text-foreground tabular-nums tracking-tight font-sans">
                {formatCurrency(cheapestPrice)}
              </span>
            </div>
          )}
        </div>
      </button>
      {groupExpanded && (
        <div className="animate-expand-down border-t border-border">
          {meds.map((med, i) => (
            <VariantRow
              key={med.id}
              med={med}
              expanded={expandedMedId === med.id}
              onToggle={() => onMedToggle(med.id)}
              isFirst={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCard({
  index,
  href,
  icon,
  title,
  description,
}: {
  index: string;
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-surface/40 p-5 transition-all duration-300 hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-12px_rgba(52,211,153,0.15)]"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/[0.05] blur-2xl transition-all duration-300 group-hover:bg-accent/[0.1]" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/15">
            {icon}
          </div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-light">
            {index}
          </span>
        </div>
        <h3 className="mt-5 text-[17px] font-semibold leading-tight text-foreground transition-colors group-hover:text-accent">
          {title}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {description}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent/70 transition-all duration-200 group-hover:text-accent group-hover:gap-2.5">
          Ler mais
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Med[]>([]);
  const [searched, setSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);

  const groups = useMemo(() => groupResults(results), [results]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
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
    <main className="mx-auto max-w-4xl px-5 md:px-8">
      {/* Hero / search section */}
      <section className="pt-8 md:pt-12 pb-2">
        <div className="flex items-baseline gap-3 md:gap-4">
          <span className="hidden md:inline font-mono text-[11px] tracking-[0.2em] text-muted-light">
            01 / BUSCA
          </span>
          <span className="hidden md:block h-px flex-1 bg-border-subtle" />
        </div>
        <h1 className="mt-2 md:mt-6 text-center md:text-left font-serif text-[38px] md:text-[44px] leading-[1.05] tracking-tight text-accent">
          <span className="md:hidden">
            Preço máximo
            <br />
            de medicamentos
            <br />
            no Brasil<span className="text-accent-dark">.</span>
          </span>
          <span className="hidden md:inline">
            Preço máximo de medicamentos no Brasil<span className="text-accent-dark">.</span>
          </span>
        </h1>
        <p className="mt-4 md:mt-4 mx-auto md:mx-0 max-w-md md:max-w-xl text-center md:text-left text-[14px] leading-relaxed text-muted">
          Acesse a base de dados oficial e garanta a{" "}
          <span className="text-foreground">transparência</span> nos valores de
          medicamentos em todo o território nacional.
        </p>

        {/* Pill search bar with inline BUSCAR button */}
        <div className="mt-6 relative">
          <svg
            className="absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-light"
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
            placeholder="Busca por nome, substância ou laboratório"
            className="w-full rounded-full border border-border bg-surface py-3 pl-12 pr-[108px] text-[14px] text-foreground outline-none transition-all duration-200 placeholder:text-muted-light focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.08)]"
          />
          <button
            type="button"
            onClick={() => search(query)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-5 py-2 text-[12px] font-bold tracking-widest text-background transition-colors hover:bg-accent-dark hover:text-foreground"
          >
            BUSCAR
          </button>
          {dataLoading && (
            <div className="absolute -bottom-6 right-2">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            </div>
          )}
        </div>

        {/* Suggestion chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5 text-[12px]">
          <span className="font-serif italic text-muted-light">Sugestões:</span>
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              onClick={() => handleInput(term)}
              className="inline-flex items-center gap-1.5 text-accent transition-colors hover:text-accent-dark"
            >
              <span className="h-1 w-1 rounded-full bg-accent" />
              {term}
            </button>
          ))}
        </div>
      </section>

      {/* Loading */}
      {dataLoading && !searched && (
        <div className="py-16 text-center animate-fade-in-up">
          <div className="mx-auto mb-3 h-7 w-7 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
          <p className="text-sm text-muted">Carregando medicamentos...</p>
        </div>
      )}

      {/* Results */}
      {!dataLoading && searched && (
        <section className="mt-6 mx-auto max-w-2xl">
          {results.length === 0 ? (
            <div className="py-12 text-center animate-fade-in-up">
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
          ) : (
            <>
              <p className="mb-3 text-[11px] font-medium text-muted-light uppercase tracking-widest">
                {groups.length} medicamento{groups.length !== 1 ? "s" : ""}
                {results.length !== groups.length && (
                  <span className="text-muted-light/60">
                    {" "}
                    · {results.length} apresentaç{results.length !== 1 ? "ões" : "ão"}
                  </span>
                )}
              </p>
              <div className="space-y-2.5">
                {groups.map((g, i) =>
                  g.meds.length === 1 ? (
                    <MedCard
                      key={g.meds[0].id}
                      med={g.meds[0]}
                      expanded={expandedId === g.meds[0].id}
                      onToggle={() =>
                        setExpandedId(
                          expandedId === g.meds[0].id ? null : g.meds[0].id
                        )
                      }
                      index={i}
                    />
                  ) : (
                    <GroupCard
                      key={g.key}
                      meds={g.meds}
                      groupExpanded={expandedGroups.has(g.key)}
                      onGroupToggle={() => toggleGroup(g.key)}
                      expandedMedId={expandedId}
                      onMedToggle={(id) =>
                        setExpandedId(expandedId === id ? null : id)
                      }
                      index={i}
                    />
                  )
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Info cards — only show when not searching */}
      {!searched && (
        <section className="mt-10 md:mt-12 animate-fade-in-up">
          <div className="hidden md:flex items-baseline gap-3 mb-5">
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-light">
              02 / ENTENDA
            </span>
            <span className="h-px flex-1 bg-border-subtle" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <InfoCard
              index="01"
              href="/guia#pmc"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
                </svg>
              }
              title="Como funciona o Preço Máximo?"
              description="Entenda as regras que limitam os valores cobrados nas farmácias e protegem o consumidor."
            />
            <InfoCard
              index="02"
              href="/guia#cmed"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
                </svg>
              }
              title="O que é CMED?"
              description="Conheça a Câmara de Regulação do Mercado de Medicamentos e seu papel no Brasil."
            />
          </div>

          {/* MedTupa promo */}
          <a
            href="https://medtupa.github.io/meds/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative mt-3 md:mt-4 flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-all duration-200 hover:border-accent/30 hover:bg-surface-hover"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-serif text-[18px] text-foreground tracking-tight">MedTupa</span>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Guia
                </span>
              </div>
              <div className="mt-0.5 text-[12px] text-muted leading-snug">
                Farmácias e medicamentos em Tupaciguara
              </div>
            </div>
            <svg className="h-4 w-4 shrink-0 text-accent transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>

          <div className="pt-2 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-3 py-1 text-[10px] text-muted-light">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent/60" />
              Fonte: CMED/ANVISA · Atualizado em fev/2026
            </span>
          </div>
        </section>
      )}
    </main>
  );
}
