// Medicines handed out free (with a prescription) by the Programa Farmácia
// Popular do Brasil. Source: Portaria GM/MS nº 12.091, de 11/08/2026, Anexo II
// ("Dos itens disponibilizados gratuitamente"), and the Ministério da Saúde
// "Elenco de Medicamentos e Insumos" updated 31/08/2026. The program covers a
// substance + strength, not a brand, so the badge is shown per group.
// Update this list when a new Portaria changes the elenco.
import { parseApresentacao, stripAccents, type Med } from "./meds";

export const FARMACIA_POPULAR_URL =
  "https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular";

const COMPRIMIDO = /\b(COM|DRG)\b/;
const COLIRIO = /\bSOL\b.*\bOFT?\b/;
const INJETAVEL = /\bINJ\b/;
const INALATORIO = /\b(AER|INAL|NEBUL)\b/;
const NASAL = /\bNAS\b/;

type Item = { subs: string[]; doses: string[]; forma: RegExp };

// Substance names without accents, components in alphabetical order.
const ITEMS: Item[] = [
  // Hipertensão
  { subs: ["ATENOLOL"], doses: ["25 MG"], forma: COMPRIMIDO },
  { subs: ["BESILATO DE ANLODIPINO"], doses: ["5 MG"], forma: COMPRIMIDO },
  { subs: ["CAPTOPRIL"], doses: ["25 MG"], forma: COMPRIMIDO },
  { subs: ["CLORIDRATO DE PROPRANOLOL"], doses: ["40 MG"], forma: COMPRIMIDO },
  { subs: ["ESPIRONOLACTONA"], doses: ["25 MG"], forma: COMPRIMIDO },
  { subs: ["FUROSEMIDA"], doses: ["40 MG"], forma: COMPRIMIDO },
  { subs: ["HIDROCLOROTIAZIDA"], doses: ["25 MG"], forma: COMPRIMIDO },
  { subs: ["LOSARTANA POTASSICA"], doses: ["50 MG"], forma: COMPRIMIDO },
  { subs: ["MALEATO DE ENALAPRIL"], doses: ["10 MG"], forma: COMPRIMIDO },
  { subs: ["SUCCINATO DE METOPROLOL"], doses: ["25 MG"], forma: COMPRIMIDO },
  // Diabetes
  { subs: ["CLORIDRATO DE METFORMINA"], doses: ["500 MG", "850 MG"], forma: COMPRIMIDO },
  { subs: ["GLIBENCLAMIDA"], doses: ["5 MG"], forma: COMPRIMIDO },
  { subs: ["DAPAGLIFLOZINA"], doses: ["10 MG"], forma: COMPRIMIDO },
  { subs: ["INSULINA HUMANA"], doses: ["100 UI"], forma: INJETAVEL },
  // Osteoporose, dislipidemia, Parkinson
  {
    subs: ["ALENDRONATO DE SODIO", "ALENDRONATO DE SODIO TRI-HIDRATADO", "ALENDRONATO SODICO TRIHIDRATADO"],
    doses: ["70 MG"],
    forma: COMPRIMIDO,
  },
  { subs: ["SINVASTATINA"], doses: ["10 MG", "20 MG", "40 MG"], forma: COMPRIMIDO },
  {
    subs: ["CARBIDOPA + LEVODOPA", "CARBIDOPA MONOIDRATADA + LEVODOPA"],
    doses: ["25 MG + 250 MG"],
    forma: COMPRIMIDO,
  },
  { subs: ["CLORIDRATO DE BENSERAZIDA + LEVODOPA"], doses: ["25 MG + 100 MG"], forma: COMPRIMIDO },
  // Anticoncepção
  { subs: ["NORETISTERONA"], doses: ["0,35 MG"], forma: COMPRIMIDO },
  {
    subs: ["ETINILESTRADIOL + LEVONORGESTREL", "ETINILESTRADIOL + LEVONORGESTREL MICRONIZADO"],
    doses: ["0,03 MG + 0,15 MG"],
    forma: COMPRIMIDO,
  },
  { subs: ["ACETATO DE MEDROXIPROGESTERONA"], doses: ["150 MG"], forma: INJETAVEL },
  {
    subs: ["ENANTATO DE NORETISTERONA + VALERATO DE ESTRADIOL"],
    doses: ["50 MG + 5 MG"],
    forma: INJETAVEL,
  },
  // Asma, rinite, glaucoma
  { subs: ["BROMETO DE IPRATROPIO"], doses: ["0,02 MG", "0,25 MG"], forma: INALATORIO },
  { subs: ["SULFATO DE SALBUTAMOL"], doses: ["100 MCG", "5 MG"], forma: INALATORIO },
  {
    subs: ["DIPROPIONATO DE BECLOMETASONA"],
    doses: ["50 MCG", "200 MCG", "250 MCG"],
    forma: /\b(AER|INAL|NAS)\b/,
  },
  { subs: ["BUDESONIDA"], doses: ["32 MCG", "50 MCG"], forma: NASAL },
  { subs: ["MALEATO DE TIMOLOL", "MALEATO ACIDO DE TIMOLOL"], doses: ["2,5 MG", "5 MG"], forma: COLIRIO },
];

function substanceKey(substancia: string): string {
  return stripAccents(substancia)
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .split("+")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join(" + ");
}

// "(25 + 250) MG" / "250 MG + 25 MG" → "25000mcg|250000mcg". Denominators
// (/ML, /DOSE) are ignored; the pharmaceutical form check covers them.
const TO_MCG: Record<string, number> = { G: 1e6, MG: 1e3, MCG: 1 };
function doseKey(conc: string): string {
  const values: string[] = [];
  let pending: number[] = [];
  for (const m of conc.toUpperCase().matchAll(/(\d+(?:[.,]\d+)?)|\/?\s*(MCG|MG|G|UI|U)\b/g)) {
    if (m[1]) {
      pending.push(parseFloat(m[1].replace(",", ".")));
    } else if (m[2] && !m[0].startsWith("/")) {
      for (const n of pending) {
        values.push(m[2] in TO_MCG ? `${Math.round(n * TO_MCG[m[2]])}mcg` : `${n}ui`);
      }
      pending = [];
    }
  }
  return values.sort().join("|");
}

const LOOKUP = new Map<string, { doses: Set<string>; forma: RegExp }>();
for (const item of ITEMS) {
  for (const sub of item.subs) {
    LOOKUP.set(substanceKey(sub), {
      doses: new Set(item.doses.map(doseKey)),
      forma: item.forma,
    });
  }
}

const cache = new Map<string, boolean>();
export function isFarmaciaPopular(med: Med): boolean {
  const cacheKey = `${med.substancia}|${med.apresentacao}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;
  const item = LOOKUP.get(substanceKey(med.substancia));
  let result = false;
  if (item) {
    const apr = med.apresentacao.toUpperCase();
    const conc = parseApresentacao(med.apresentacao).concentracao || apr;
    result = item.forma.test(apr) && !/\bCAP\b/.test(apr) && item.doses.has(doseKey(conc));
  }
  cache.set(cacheKey, result);
  return result;
}
