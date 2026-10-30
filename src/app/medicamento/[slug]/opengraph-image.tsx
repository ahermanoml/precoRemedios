import { getSubstances } from "@/lib/meds-server";
import { formatCurrency, priceAt, substanceName } from "@/lib/meds";
import { aliquotaPara, DEFAULT_UF } from "@/lib/icms";
import { ogCard, OG_SIZE } from "@/lib/og";
import { CMED_MES } from "@/lib/site";

export const alt = "Preço máximo do medicamento na lista da CMED";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return [];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meds = getSubstances().get(slug) ?? [];
  const name = meds.length ? substanceName(meds[0].substancia) : "Medicamento";
  const cheapest = Math.min(...meds.map((m) => priceAt(m, aliquotaPara(DEFAULT_UF, m)) ?? Infinity));
  return ogCard({
    title: name.length > 70 ? `${name.slice(0, 67)}…` : name,
    subtitle: Number.isFinite(cheapest)
      ? `Preço máximo a partir de ${formatCurrency(cheapest)} (${DEFAULT_UF}) · ${meds.length} apresentaç${meds.length !== 1 ? "ões" : "ão"}`
      : "Preço máximo ao consumidor",
    footer: `Lista oficial CMED/Anvisa · ${CMED_MES} · medpreco.com`,
  });
}
