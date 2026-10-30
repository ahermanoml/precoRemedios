// ICMS rate that applies to medicines sold in pharmacies in each state, i.e.
// which CMED PMC column is the legal ceiling there. The CMED list doesn't map
// states to columns ("cabe ao comerciante checar a alíquota aplicável"), so
// this table comes from state law / SEFAZ (researched Oct/2026):
// - DF: specific 17% rate for medicines (Lei 1.254/96, art. 18, II, "i")
// - SE, AL: the FECOEP add-on doesn't apply to medicines
// - RJ: 20% + 2% FECP
// - MG (RICMS/2023, Anexo I, 4.4) and SP (RICMS art. 54, XIX): genéricos 12%
// Recent changes: MA 23% (02/2025), RN 20% (03/2025), PI 22,5% (04/2025),
// AL 20,5% (04/2026). Review when a state changes its rate.
import type { Med } from "./meds";

type Uf = { uf: string; nome: string; aliquota: string; aliquotaGenerico?: string };

export const UFS: Uf[] = [
  { uf: "AC", nome: "Acre", aliquota: "19%" },
  { uf: "AL", nome: "Alagoas", aliquota: "20,5%" },
  { uf: "AM", nome: "Amazonas", aliquota: "20%" },
  { uf: "AP", nome: "Amapá", aliquota: "18%" },
  { uf: "BA", nome: "Bahia", aliquota: "20,5%" },
  { uf: "CE", nome: "Ceará", aliquota: "20%" },
  { uf: "DF", nome: "Distrito Federal", aliquota: "17%" },
  { uf: "ES", nome: "Espírito Santo", aliquota: "17%" },
  { uf: "GO", nome: "Goiás", aliquota: "19%" },
  { uf: "MA", nome: "Maranhão", aliquota: "23%" },
  { uf: "MG", nome: "Minas Gerais", aliquota: "18%", aliquotaGenerico: "12%" },
  { uf: "MS", nome: "Mato Grosso do Sul", aliquota: "17%" },
  { uf: "MT", nome: "Mato Grosso", aliquota: "17%" },
  { uf: "PA", nome: "Pará", aliquota: "19%" },
  { uf: "PB", nome: "Paraíba", aliquota: "20%" },
  { uf: "PE", nome: "Pernambuco", aliquota: "20,5%" },
  { uf: "PI", nome: "Piauí", aliquota: "22,5%" },
  { uf: "PR", nome: "Paraná", aliquota: "19,5%" },
  { uf: "RJ", nome: "Rio de Janeiro", aliquota: "22%" },
  { uf: "RN", nome: "Rio Grande do Norte", aliquota: "20%" },
  { uf: "RO", nome: "Rondônia", aliquota: "19,5%" },
  { uf: "RR", nome: "Roraima", aliquota: "20%" },
  { uf: "RS", nome: "Rio Grande do Sul", aliquota: "17%" },
  { uf: "SC", nome: "Santa Catarina", aliquota: "17%" },
  { uf: "SE", nome: "Sergipe", aliquota: "19%" },
  { uf: "SP", nome: "São Paulo", aliquota: "18%", aliquotaGenerico: "12%" },
  { uf: "TO", nome: "Tocantins", aliquota: "20%" },
];

export const DEFAULT_UF = "SP";

const BY_UF = new Map(UFS.map((u) => [u.uf, u]));

function get(uf: string): Uf {
  return BY_UF.get(uf) ?? BY_UF.get(DEFAULT_UF)!;
}

export function isUf(uf: string): boolean {
  return BY_UF.has(uf);
}

/** "SP" → "18%" (general rate for medicines) */
export function aliquotaDe(uf: string): string {
  return get(uf).aliquota;
}

/** "SP" → "12%" for genéricos, when the state has a reduced rate */
export function aliquotaGenericoDe(uf: string): string | undefined {
  return get(uf).aliquotaGenerico;
}

/** The PMC column that is the ceiling for this medicine in this state. */
export function aliquotaPara(uf: string, med: Pick<Med, "tipo">): string {
  const u = get(uf);
  return med.tipo === "Genérico" && u.aliquotaGenerico ? u.aliquotaGenerico : u.aliquota;
}

/** Rates some state applies, ascending, with who applies them. */
export const ALIQUOTAS_USADAS: { aliquota: string; quem: string }[] = (() => {
  const rates = new Set(UFS.flatMap((u) => [u.aliquota, u.aliquotaGenerico ?? u.aliquota]));
  const num = (r: string) => parseFloat(r.replace(",", "."));
  return [...rates]
    .sort((a, b) => num(a) - num(b))
    .map((aliquota) => {
      const all = UFS.filter((u) => u.aliquota === aliquota).map((u) => u.uf);
      const gen = UFS.filter((u) => u.aliquotaGenerico === aliquota).map((u) => u.uf);
      const parts = [all.join(", "), gen.length ? `genéricos em ${gen.join(", ")}` : ""];
      return { aliquota, quem: parts.filter(Boolean).join(" · ") };
    });
})();
