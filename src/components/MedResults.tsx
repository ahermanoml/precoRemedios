"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildCardTitle,
  capitalize,
  formatCurrency,
  getGroupKey,
  parseApresentacao,
  priceAt,
  substanceName,
  substanceSlug,
  tarjaLabel,
  TIPO_LABEL,
  unitPriceAt,
  brandName,
  type Med,
} from "@/lib/meds";
import { ALIQUOTAS_USADAS, aliquotaPara } from "@/lib/icms";
import { FARMACIA_POPULAR_URL, isFarmaciaPopular } from "@/lib/farmacia-popular";
import { toggleFavorito, useFavoritos, useUf } from "@/lib/preferences";
import { UfSelect } from "./UfSelect";

type Sort = "unidade" | "caixa";

// Ceiling for this medicine in the visitor's state (genéricos may differ)
function price(med: Med, uf: string): number | null {
  return priceAt(med, aliquotaPara(uf, med));
}

function unitPrice(med: Med, uf: string): number | null {
  return unitPriceAt(med, aliquotaPara(uf, med));
}

function compareBy(sort: Sort, uf: string) {
  return (a: Med, b: Med) => {
    const pa = price(a, uf) ?? Infinity;
    const pb = price(b, uf) ?? Infinity;
    if (sort === "unidade") {
      const ua = unitPrice(a, uf) ?? Infinity;
      const ub = unitPrice(b, uf) ?? Infinity;
      if (ua !== ub) return ua - ub;
    }
    return pa - pb;
  };
}

function groupResults(results: Med[]): Array<{ key: string; meds: Med[] }> {
  const map = new Map<string, Med[]>();
  for (const med of results) {
    const key = getGroupKey(med);
    const list = map.get(key);
    if (list) list.push(med);
    else map.set(key, [med]);
  }
  return [...map.entries()].map(([key, meds]) => ({ key, meds }));
}

function unitLabel(med: Med): string {
  return parseApresentacao(med.apresentacao).unidades?.nome ?? "unidade";
}

/**
 * How much cheaper the best generic is than the reference ("Novo") drug,
 * per tablet when both are countable, otherwise for the same package.
 */
function genericSavings(meds: Med[], uf: string): { pct: number; ref: Med } | null {
  const refs = meds.filter((m) => m.tipo === "Novo");
  const gens = meds.filter((m) => m.tipo === "Genérico");
  if (!refs.length || !gens.length) return null;

  // Compare against the reference's cheapest option, never its priciest pack
  let best: { pct: number; ref: Med } | null = null;
  const consider = (ref: Med, refPrice: number | null, genPrice: number) => {
    if (refPrice === null || refPrice <= 0) return;
    const pct = 1 - genPrice / refPrice;
    if (!best || pct < best.pct) best = { pct, ref };
  };

  const genUnits = gens.map((g) => unitPrice(g, uf)).filter((p): p is number => p !== null);
  if (genUnits.length) {
    const minGen = Math.min(...genUnits);
    for (const ref of refs) consider(ref, unitPrice(ref, uf), minGen);
  }
  if (!best) {
    for (const ref of refs) {
      const emb = parseApresentacao(ref.apresentacao).embalagem;
      const same = gens
        .filter((g) => parseApresentacao(g.apresentacao).embalagem === emb)
        .map((g) => price(g, uf))
        .filter((p): p is number => p !== null);
      if (same.length) consider(ref, price(ref, uf), Math.min(...same));
    }
  }
  const result = best as { pct: number; ref: Med } | null;
  return result && result.pct >= 0.1 ? { pct: Math.round(result.pct * 100), ref: result.ref } : null;
}

function TipoBadge({ tipo }: { tipo: string }) {
  const classes: Record<string, string> = {
    "Genérico": "bg-emerald-400/10 text-emerald-400",
    "Similar": "bg-amber-400/10 text-amber-400",
    "Novo": "bg-sky-400/10 text-sky-400",
    "Biológico": "bg-violet-400/10 text-violet-400",
  };
  if (!tipo || tipo === "-") return null;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${classes[tipo] || "bg-foreground/5 text-muted"}`}
    >
      {TIPO_LABEL[tipo] || tipo}
    </span>
  );
}

function FarmaciaPopularPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Grátis no Farmácia Popular
    </span>
  );
}

function UnitPrice({ med, uf, className = "" }: { med: Med; uf: string; className?: string }) {
  const unit = unitPrice(med, uf);
  if (unit === null) return null;
  return (
    <span className={`text-[11px] text-muted-light tabular-nums ${className}`}>
      {formatCurrency(unit)}/{unitLabel(med)}
    </span>
  );
}

function FavoriteButton({ med }: { med: Med }) {
  const favoritos = useFavoritos();
  const saved = favoritos.includes(med.ggrem);
  return (
    <button
      type="button"
      onClick={() => toggleFavorito(med.ggrem)}
      aria-pressed={saved}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
        saved
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border text-muted hover:border-accent/40 hover:text-foreground"
      }`}
    >
      <svg className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
      {saved ? "Salvo nos favoritos" : "Salvar nos favoritos"}
    </button>
  );
}

function MedDetails({ med, showPageLink }: { med: Med; showPageLink: boolean }) {
  const [uf] = useUf();
  const rate = aliquotaPara(uf, med);
  const ceiling = priceAt(med, rate);
  const tarja = tarjaLabel(med.tarja);

  return (
    <div className="animate-expand-down border-t border-border-subtle px-5 pb-5 pt-4">
      {ceiling !== null && (
        <div className="mb-4 rounded-lg border border-accent/10 bg-accent-light/60 px-3.5 py-2.5 text-xs leading-relaxed text-accent">
          Em <strong className="font-semibold">{uf}</strong> (ICMS {rate}{med.tipo === "Genérico" && rate === "12%" ? " para genéricos" : ""}),
          nenhuma farmácia pode cobrar mais que <strong className="font-semibold">{formatCurrency(ceiling)}</strong> por
          esta caixa. Desconto é permitido.{" "}
          <Link href="/guia#denuncia" className="font-semibold underline underline-offset-2 hover:text-foreground">
            Cobraram mais? Veja como denunciar
          </Link>
        </div>
      )}

      {isFarmaciaPopular(med) && (
        <p className="mb-4 rounded-lg border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-foreground">De graça com receita</span> nas farmácias credenciadas ao{" "}
          <a href={FARMACIA_POPULAR_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
            Farmácia Popular
          </a>
          . O programa cobre a substância nesta dosagem, não uma marca específica.
        </p>
      )}

      <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-light">
        Preço máximo por alíquota de ICMS
      </h4>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {ALIQUOTAS_USADAS.filter(({ aliquota: r }) => med.pmc[r] !== undefined).map(({ aliquota: r, quem }) => {
          const isHighlighted = r === rate;
          return (
            <div
              key={r}
              className={`rounded-lg p-2.5 text-center transition-colors ${
                isHighlighted ? "border border-accent/15 bg-accent-light" : "bg-foreground/[0.04]"
              }`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isHighlighted ? "text-accent" : "text-muted-light"}`}>
                ICMS {r}
              </p>
              <p className={`mt-0.5 text-sm font-bold tabular-nums ${isHighlighted ? "text-accent" : "text-foreground"}`}>
                {formatCurrency(med.pmc[r])}
              </p>
              <p className="mt-0.5 text-[9px] leading-tight text-muted-light">{quem}</p>
            </div>
          );
        })}
      </div>
      {med.icmsIsento && med.pmc["0%"] !== undefined && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Princípio ativo com isenção de ICMS prevista em convênio do CONFAZ. Nos estados que aplicam a isenção, o teto é{" "}
          <strong className="text-foreground">{formatCurrency(med.pmc["0%"])}</strong> (ICMS 0%).
        </p>
      )}

      <dl className="mt-4 grid gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-2">
        {med.ean && (
          <div>
            <dt className="inline text-muted-light">Código de barras: </dt>
            <dd className="inline font-mono text-foreground">{med.ean}</dd>
          </div>
        )}
        {tarja && (
          <div>
            <dt className="inline text-muted-light">Tarja: </dt>
            <dd className="inline text-foreground">{tarja}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="inline text-muted-light">Laboratório: </dt>
          <dd className="inline text-foreground">{med.laboratorio}</dd>
        </div>
        {med.classeTerapeutica && (
          <div className="sm:col-span-2">
            <dt className="inline text-muted-light">Classe: </dt>
            <dd className="inline text-muted">{med.classeTerapeutica}</dd>
          </div>
        )}
        {med.hospitalar && <dd className="font-semibold text-amber-400">Uso restrito a hospitais</dd>}
      </dl>

      <p className="mt-3 font-mono text-[10px] tracking-tight text-muted-light/60">{med.apresentacao}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FavoriteButton med={med} />
        {showPageLink && (
          <Link
            href={`/medicamento/${substanceSlug(med)}`}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium text-accent hover:text-accent-dark"
          >
            Todas as apresentações de {substanceName(med.substancia)} →
          </Link>
        )}
      </div>
    </div>
  );
}

function Chevron({ open, small }: { open: boolean; small?: boolean }) {
  return (
    <svg
      className={`${small ? "h-3.5 w-3.5" : "mt-0.5 h-4 w-4"} shrink-0 text-muted-light transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const CARD =
  "group relative rounded-xl border border-border bg-surface transition-all duration-200";
const CARD_HOVER = "hover:border-accent/30 hover:shadow-[0_2px_20px_-4px_rgba(52,211,153,0.1)]";

function stagger(index: number) {
  return index < 10 ? `stagger-${index + 1}` : "stagger-10";
}

export function MedCard({
  med,
  expanded,
  onToggle,
  index,
  showPageLink = true,
}: {
  med: Med;
  expanded: boolean;
  onToggle: () => void;
  index: number;
  showPageLink?: boolean;
}) {
  const [uf] = useUf();
  const mainPrice = price(med, uf);
  const parsed = parseApresentacao(med.apresentacao);

  return (
    <div className={`animate-fade-in-up ${stagger(index)} ${CARD} ${CARD_HOVER}`}>
      <button onClick={onToggle} className="w-full p-5 text-left" aria-expanded={expanded}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-[15px] font-semibold leading-tight text-foreground">
                {buildCardTitle(med.produto, parsed)}
              </h3>
              <TipoBadge tipo={med.tipo} />
              {isFarmaciaPopular(med) && <FarmaciaPopularPill />}
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-muted">
              {substanceName(med.substancia)}
              {parsed.forma && <span className="text-muted-light"> · {parsed.forma}</span>}
            </p>
          </div>
          <Chevron open={expanded} />
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-4">
          <span className="truncate text-[11px] uppercase tracking-wide text-muted-light">{med.laboratorio}</span>
          {mainPrice !== null && (
            <div className="flex shrink-0 flex-col items-end">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-light">PMC</span>
                <span className="font-sans text-xl font-bold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(mainPrice)}
                </span>
              </div>
              <UnitPrice med={med} uf={uf} />
            </div>
          )}
        </div>
      </button>

      {expanded && <MedDetails med={med} showPageLink={showPageLink} />}
    </div>
  );
}

function VariantRow({
  med,
  expanded,
  onToggle,
  isFirst,
  showPageLink,
}: {
  med: Med;
  expanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  showPageLink: boolean;
}) {
  const [uf] = useUf();
  const parsed = parseApresentacao(med.apresentacao);
  const mainPrice = price(med, uf);

  return (
    <div className={`relative ${!isFirst ? "border-t border-border-subtle" : ""}`}>
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 text-left transition-colors hover:bg-foreground/[0.03]"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[13px] font-medium text-foreground">
                {med.tipo === "Novo" || med.tipo === "Similar" ? `${med.produto} · ` : ""}
                {med.laboratorio}
              </span>
              <TipoBadge tipo={med.tipo} />
            </div>
            {parsed.embalagem && (
              <p className="mt-0.5 truncate text-[12px] text-muted-light">{capitalize(parsed.embalagem)}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mainPrice !== null && (
              <div className="flex flex-col items-end">
                <span className="text-[15px] font-bold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(mainPrice)}
                </span>
                <UnitPrice med={med} uf={uf} />
              </div>
            )}
            <Chevron open={expanded} small />
          </div>
        </div>
      </button>
      {expanded && <MedDetails med={med} showPageLink={showPageLink} />}
    </div>
  );
}

function GroupCard({
  meds,
  sort,
  groupExpanded,
  onGroupToggle,
  expandedMedId,
  onMedToggle,
  index,
  showPageLink,
}: {
  meds: Med[];
  sort: Sort;
  groupExpanded: boolean;
  onGroupToggle: () => void;
  expandedMedId: number | null;
  onMedToggle: (id: number) => void;
  index: number;
  showPageLink: boolean;
}) {
  const [uf] = useUf();
  const sorted = useMemo(() => [...meds].sort(compareBy(sort, uf)), [meds, sort, uf]);
  const first = sorted[0];
  const parsed = parseApresentacao(first.apresentacao);
  const labs = new Set(meds.map((m) => m.laboratorio)).size;
  const cheapestBox = Math.min(...meds.map((m) => price(m, uf) ?? Infinity));
  const units = meds.map((m) => unitPrice(m, uf)).filter((p): p is number => p !== null);
  const cheapestUnit = units.length ? Math.min(...units) : null;
  const savings = genericSavings(meds, uf);
  const farmaciaPopular = meds.some(isFarmaciaPopular);
  const name = substanceName(first.substancia);
  const title = parsed.concentracao ? `${name} ${parsed.concentracao.replace(/\s+/g, "")}` : name;
  const showUnitHeadline = sort === "unidade" && cheapestUnit !== null;

  return (
    <div className={`animate-fade-in-up ${stagger(index)} ${CARD} ${!groupExpanded ? CARD_HOVER : ""}`}>
      <button onClick={onGroupToggle} className="w-full p-5 text-left" aria-expanded={groupExpanded}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight text-foreground">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-snug text-muted">
              {parsed.forma || "Apresentações"}
              <span className="text-muted-light">
                {" "}
                · {meds.length} apresentaç{meds.length !== 1 ? "ões" : "ão"}
              </span>
            </p>
            {(farmaciaPopular || savings) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {farmaciaPopular && <FarmaciaPopularPill />}
                {savings && (
                  <span className="inline-flex items-center rounded-md bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                    Genérico até {savings.pct}% mais barato que o {brandName(savings.ref.produto)}
                  </span>
                )}
              </div>
            )}
          </div>
          <Chevron open={groupExpanded} />
        </div>
        <div className="mt-3.5 flex items-end justify-between gap-4">
          <span className="min-w-0 text-[11px] uppercase tracking-wide text-muted-light">
            {labs} laboratório{labs !== 1 ? "s" : ""}
          </span>
          {Number.isFinite(cheapestBox) && (
            <div className="flex shrink-0 flex-col items-end">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-light">a partir de</span>
                <span className="font-sans text-xl font-bold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(showUnitHeadline ? cheapestUnit! : cheapestBox)}
                </span>
                {showUnitHeadline && (
                  <span className="text-[11px] text-muted-light">/{unitLabel(first)}</span>
                )}
              </div>
              <span className="text-[11px] text-muted-light tabular-nums">
                {showUnitHeadline
                  ? `caixa a partir de ${formatCurrency(cheapestBox)}`
                  : cheapestUnit !== null
                    ? `ou ${formatCurrency(cheapestUnit)}/${unitLabel(first)}`
                    : ""}
              </span>
            </div>
          )}
        </div>
      </button>
      {groupExpanded && (
        <div className="animate-expand-down border-t border-border">
          {sorted.map((med, i) => (
            <VariantRow
              key={med.id}
              med={med}
              expanded={expandedMedId === med.id}
              onToggle={() => onMedToggle(med.id)}
              isFirst={i === 0}
              showPageLink={showPageLink}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Medicines grouped by substance + strength + form, with the state picker,
 * a sort toggle (box vs. per tablet) and "show more" pagination.
 */
export function MedResults({
  meds,
  expandAll = false,
  showPageLinks = true,
  pageSize = 15,
}: {
  meds: Med[];
  expandAll?: boolean;
  showPageLinks?: boolean;
  pageSize?: number;
}) {
  const groups = useMemo(() => groupResults(meds), [meds]);
  const [sort, setSort] = useState<Sort>("unidade");
  const [visible, setVisible] = useState(pageSize);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(expandAll ? groups.map((g) => g.key) : [])
  );
  const hasUnits = useMemo(() => meds.some((m) => parseApresentacao(m.apresentacao).unidades), [meds]);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleMed = (id: number) => setExpandedId((cur) => (cur === id ? null : id));

  const shown = groups.slice(0, visible);
  const remaining = groups.length - shown.length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-light">
          {groups.length} medicamento{groups.length !== 1 ? "s" : ""}
          {meds.length !== groups.length && (
            <span className="text-muted-light/60">
              {" "}
              · {meds.length} apresentaç{meds.length !== 1 ? "ões" : "ão"}
            </span>
          )}
        </p>
        <UfSelect />
      </div>
      {hasUnits && (
        <div className="mb-3 flex items-center gap-2 text-[12px] text-muted" role="group" aria-label="Ordenar">
          <span>Ordenar por</span>
          {(
            [
              ["unidade", "preço por unidade"],
              ["caixa", "preço da caixa"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              aria-pressed={sort === value}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                sort === value ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2.5">
        {shown.map((g, i) =>
          g.meds.length === 1 ? (
            <MedCard
              key={g.meds[0].id}
              med={g.meds[0]}
              expanded={expandedId === g.meds[0].id}
              onToggle={() => toggleMed(g.meds[0].id)}
              index={i}
              showPageLink={showPageLinks}
            />
          ) : (
            <GroupCard
              key={g.key}
              meds={g.meds}
              sort={sort}
              groupExpanded={expandedGroups.has(g.key)}
              onGroupToggle={() => toggleGroup(g.key)}
              expandedMedId={expandedId}
              onMedToggle={toggleMed}
              index={i}
              showPageLink={showPageLinks}
            />
          )
        )}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + pageSize)}
          className="mt-4 w-full rounded-xl border border-border py-3 text-[13px] font-medium text-accent transition-colors hover:border-accent/40 hover:bg-surface"
        >
          Mostrar mais {Math.min(remaining, pageSize)} de {remaining} medicamento{remaining !== 1 ? "s" : ""}
        </button>
      )}
    </>
  );
}
