import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubstances } from "@/lib/meds-server";
import {
  brandName,
  formatCurrency,
  getGroupKey,
  parseApresentacao,
  priceAt,
  stripAccents,
  substanceName,
  unitPriceAt,
  type Med,
} from "@/lib/meds";
import { aliquotaPara, DEFAULT_UF } from "@/lib/icms";
import { isFarmaciaPopular, FARMACIA_POPULAR_URL } from "@/lib/farmacia-popular";
import { CMED_DATA, CMED_MES, SITE_NAME } from "@/lib/site";
import { MedResults } from "@/components/MedResults";

// Rendered on first visit and cached until the next deploy (the data only
// changes with a deploy). The sitemap lists every slug.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

function summarize(meds: Med[]) {
  const name = substanceName(meds[0].substancia);
  const labs = new Set(meds.map((m) => m.laboratorio)).size;
  const brandCounts = new Map<string, number>();
  for (const m of meds) {
    // Genéricos carry the substance name by law; other types have a brand
    if (m.tipo === "Genérico" || stripAccents(m.produto).toUpperCase() === stripAccents(name).toUpperCase()) continue;
    const brand = brandName(m.produto);
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
  }
  const brands = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  const price = (m: Med) => priceAt(m, aliquotaPara(DEFAULT_UF, m));
  const cheapest = Math.min(...meds.map((m) => price(m) ?? Infinity));
  const units = meds
    .map((m) => unitPriceAt(m, aliquotaPara(DEFAULT_UF, m)))
    .filter((p): p is number => p !== null);
  return {
    name,
    labs,
    brands,
    cheapest: Number.isFinite(cheapest) ? cheapest : null,
    cheapestUnit: units.length ? Math.min(...units) : null,
    farmaciaPopular: meds.some(isFarmaciaPopular),
  };
}

function firstNumber(s: string): number {
  const m = s.match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(",", ".")) : Infinity;
}

// Strength ascending, then form, so the page reads like a price table
function sortForPage(meds: Med[]): Med[] {
  return [...meds].sort((a, b) => {
    const pa = parseApresentacao(a.apresentacao);
    const pb = parseApresentacao(b.apresentacao);
    return (
      firstNumber(pa.concentracao) - firstNumber(pb.concentracao) ||
      pa.forma.localeCompare(pb.forma) ||
      getGroupKey(a).localeCompare(getGroupKey(b))
    );
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meds = getSubstances().get(slug);
  if (!meds) return {};
  const s = summarize(meds);
  const brands = s.brands.slice(0, 3);
  const title = `Preço máximo de ${s.name}${brands.length ? ` (${brands.join(", ")})` : ""} — CMED ${CMED_MES}`;
  const description =
    `Preço máximo ao consumidor de ${s.name}: ${meds.length} apresentaç${meds.length !== 1 ? "ões" : "ão"} ` +
    `de ${s.labs} laboratório${s.labs !== 1 ? "s" : ""}` +
    (s.cheapest !== null ? `, a partir de ${formatCurrency(s.cheapest)} em ${DEFAULT_UF}` : "") +
    `. Veja o valor para o ICMS do seu estado. Lista oficial CMED/Anvisa de ${CMED_DATA}.`;
  return {
    title,
    description,
    alternates: { canonical: `/medicamento/${slug}` },
    openGraph: { title, description, url: `/medicamento/${slug}`, type: "website", siteName: SITE_NAME, locale: "pt_BR" },
  };
}

export default async function MedicamentoPage({ params }: Props) {
  const { slug } = await params;
  const substances = getSubstances();
  const meds = substances.get(slug);
  if (!meds) notFound();
  const s = summarize(meds);

  // Single substance → link to its combinations ("Losartana" → "+ Hidroclorotiazida")
  const combos: { slug: string; name: string }[] = [];
  if (!s.name.includes("+")) {
    for (const [otherSlug, other] of substances) {
      const otherName = substanceName(other[0].substancia);
      if (otherSlug !== slug && otherName.split(" + ").includes(s.name)) {
        combos.push({ slug: otherSlug, name: otherName });
      }
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 md:px-8 md:pt-10">
      <nav className="text-[12px] text-muted-light" aria-label="Navegação">
        <Link href="/" className="hover:text-accent">
          Busca
        </Link>{" "}
        › <span className="text-muted">{s.name}</span>
      </nav>

      <h1 className="mt-3 font-serif text-[32px] leading-[1.1] tracking-tight text-accent md:text-[40px]">
        Preço máximo de {s.name}
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        {meds.length} apresentaç{meds.length !== 1 ? "ões" : "ão"} de {s.labs} laboratório
        {s.labs !== 1 ? "s" : ""} na lista da CMED publicada em {CMED_DATA}.
        {s.cheapest !== null && (
          <>
            {" "}
            Em {DEFAULT_UF}, a caixa mais barata pode custar no máximo{" "}
            <strong className="text-foreground">{formatCurrency(s.cheapest)}</strong>
            {s.cheapestUnit !== null && (
              <>
                {" "}
                e o menor preço por unidade é{" "}
                <strong className="text-foreground">{formatCurrency(s.cheapestUnit)}</strong>
              </>
            )}
            . Escolha seu estado abaixo para ver o valor com o seu ICMS.
          </>
        )}
      </p>
      {s.brands.length > 0 && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          <span className="text-muted-light">Marcas:</span> {s.brands.slice(0, 12).join(", ")}
        </p>
      )}
      {s.farmaciaPopular && (
        <p className="mt-3 rounded-lg border border-accent/15 bg-accent-light/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-accent">
          Algumas dosagens saem de graça, com receita, no{" "}
          <a href={FARMACIA_POPULAR_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
            Farmácia Popular
          </a>{" "}
          — veja o selo nas apresentações abaixo.
        </p>
      )}

      <section className="mt-8">
        <MedResults meds={sortForPage(meds)} expandAll showPageLinks={false} pageSize={1000} />
      </section>

      {combos.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-light">
            Combinações com {s.name}
          </h2>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            {combos.map((c) => (
              <li key={c.slug}>
                <Link href={`/medicamento/${c.slug}`} className="text-accent hover:text-accent-dark">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-[13px] text-muted">
        <Link href="/guia#denuncia" className="text-accent hover:text-accent-dark">
          Cobraram mais que o preço máximo? Veja como denunciar →
        </Link>
      </p>
    </main>
  );
}
