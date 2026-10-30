// Shared data model for the CMED list: decoding public/data/meds.json,
// parsing ANVISA presentation strings, grouping and price helpers.

export interface Med {
  id: number;
  /** Código GGREM da CMED — stable across list updates (favorites use it) */
  ggrem: string;
  substancia: string;
  laboratorio: string;
  produto: string;
  apresentacao: string;
  classeTerapeutica: string;
  tipo: string;
  ean: string;
  tarja: string;
  hospitalar: boolean;
  /** Princípio ativo isento de ICMS por convênio CONFAZ (coluna "ICMS 0%") */
  icmsIsento: boolean;
  /** PMC by ICMS rate ("0%", "12%", "17,5%", …) */
  pmc: Record<string, number>;
}

/** Layout written by scripts/parse-prices.mjs */
export interface MedsFile {
  publicadaEm: string;
  rates: string[];
  dicts: {
    substancia: string[];
    laboratorio: string[];
    classe: string[];
    tipo: string[];
    tarja: string[];
  };
  // [ggrem, substancia#, laboratorio#, produto, apresentacao, classe#, tipo#,
  //  ean, tarja#, flags (1 = restrição hospitalar, 2 = ICMS 0%), pmc per rate]
  meds: [string, number, number, string, string, number, number, string, number, number, (number | null)[]][];
}

export function decodeMeds(file: MedsFile): Med[] {
  const { dicts, rates } = file;
  return file.meds.map((m, id) => {
    const pmc: Record<string, number> = {};
    m[10].forEach((p, i) => {
      if (p !== null) pmc[rates[i]] = p;
    });
    return {
      id,
      ggrem: m[0],
      substancia: dicts.substancia[m[1]],
      laboratorio: dicts.laboratorio[m[2]],
      produto: m[3],
      apresentacao: m[4],
      classeTerapeutica: dicts.classe[m[5]],
      tipo: dicts.tipo[m[6]],
      ean: m[7],
      tarja: dicts.tarja[m[8]],
      hospitalar: (m[9] & 1) !== 0,
      icmsIsento: (m[9] & 2) !== 0,
      pmc,
    };
  });
}

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Name without regulatory notes: "Levodopa + Carbidopa (PORT. 344/98 …)" → "Levodopa + Carbidopa" */
export function substanceName(substancia: string): string {
  return substancia.replace(/\s*\([^)]*\)/g, "").trim();
}

export function substanceSlug(med: Pick<Med, "substancia">): string {
  return slugify(substanceName(med.substancia));
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// "2026-10-09" → "out/2026"
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function monthYear(isoDate: string): string {
  const [y, m] = isoDate.split("-");
  return `${MONTHS[parseInt(m) - 1]}/${y}`;
}

// "2026-10-09" → "09/10/2026"
export function brDate(isoDate: string): string {
  return isoDate.split("-").reverse().join("/");
}

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
  "SOL CAP": "Solução capilar",
  "SOL": "Solução",
  "SUSP OR": "Suspensão oral",
  "SUSP INJ": "Suspensão injetável",
  "SUSP": "Suspensão",
  "SUS OR": "Suspensão oral",
  "SUS GOT OR": "Suspensão oral (gotas)",
  "SUS INJ": "Suspensão injetável",
  "SUS OFT": "Suspensão oftálmica",
  "SUS SPR NAS": "Spray nasal",
  "SUS AQUOSA NAS": "Spray nasal",
  "SUS INAL": "Suspensão para inalação",
  "SUS": "Suspensão",
  "SOL INAL": "Solução para inalação",
  "ADES TRANSD": "Adesivo transdérmico",
  "PAS": "Pastilha",
  "PAS DURA": "Pastilha dura",
  "ELX": "Elixir",
  "COLUT": "Colutório",
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
const SORTED_FORMS = Object.entries(FORM_MAP).sort((a, b) => b[0].length - a[0].length);

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

export interface Apresentacao {
  concentracao: string;
  forma: string;
  embalagem: string;
  /** Countable units in the box (tablets, capsules, drágeas), when parseable */
  unidades: { qtd: number; nome: string } | null;
}

const UNIT = "(?:MUI|MG|MCG|ML|UI|U|ME|G|%)";
const UNIT_RATIO = `(?:${UNIT}(?:\\/(?:ML|G|L|DOSE|INAL|H|DIA|COM))?)`;
const NUM = "[\\d][\\d,. ]*[\\d,]|[\\d]";
const PNUM = "[\\d][\\d,.]*";
const PAREN_GROUP = `\\(${PNUM}(?:\\s*(?:${UNIT_RATIO})?\\s*\\+\\s*${PNUM})*(?:\\s*${UNIT_RATIO})?\\s*\\)`;
const VALUE = `(?:(?:${PAREN_GROUP}|${NUM})\\s*${UNIT_RATIO}?)`;
const CONC_RE = new RegExp(`^(${VALUE}(?:\\s*\\+\\s*${VALUE})*)(?:\\/${UNIT})?`, "i");
const UNIT_RE = new RegExp(UNIT, "i");

// Solid units: "… X 30" at the end (optionally "(EMB FRAC)" etc.), times the
// number of blisters/envelopes when spelled out ("CT 2 BL … X 07" = 14).
function countUnits(upper: string, forma: string): Apresentacao["unidades"] {
  const lower = forma.toLowerCase();
  const nome = lower.includes("comprimido")
    ? "comprimido"
    : lower.includes("cápsula")
      ? "cápsula"
      : lower.includes("drágea")
        ? "drágea"
        : null;
  if (!nome) return null;
  const tail = upper.match(/\bX\s*(\d+)\s*(?:\([^)]*\))?\s*$/);
  if (!tail) return null;
  let qtd = parseInt(tail[1]);
  const mult = upper.match(/\bCT\s+(\d+)\s+(?:BL|ENV|STRIP)\b/);
  if (mult) qtd *= parseInt(mult[1]);
  return qtd > 0 ? { qtd, nome } : null;
}

function parseApresentacaoUncached(raw: string): Apresentacao {
  const s = raw.trim();

  const concMatch = s.match(CONC_RE);
  const hasUnit = concMatch?.[1] && UNIT_RE.test(concMatch[1]);
  const concentracao = (concMatch && hasUnit) ? concMatch[0].trim() : "";
  const rest = (concMatch && hasUnit) ? s.slice(concMatch[0].length).trim() : s;

  let forma = "";
  let afterForm = rest;
  for (const [abbr, name] of SORTED_FORMS) {
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
  const unidades = countUnits(upper, forma);

  const m1 = upper.match(
    /(\d+)\s*(AMP|SER PREENC|SER|FA|ENV|SAC|FLA|CAN|CAR)\b.*?X\s*([\d,.]+)\s*(ML|G|MG|L|DOSES?)/i
  );
  if (m1) {
    const qty = m1[1];
    const container = CONTAINER_MAP[m1[2]] || m1[2].toLowerCase();
    embalagem = `${qty} ${container}${parseInt(qty) > 1 ? "s" : ""} de ${m1[3]} ${m1[4].toLowerCase()}`;
  }

  if (!embalagem) {
    const m2 = upper.match(/(?:FR|TB|BG)\b.*?X\s*([\d,.]+)\s*(ML|G|MG|L)/i);
    if (m2) {
      const containerMatch = upper.match(/(FR|TB|BG)\b/);
      const container = containerMatch
        ? CONTAINER_MAP[containerMatch[1]] || containerMatch[1].toLowerCase()
        : "frasco";
      embalagem = `${container} de ${m2[1]} ${m2[2].toLowerCase()}`;

      if (/\+\s*COP/.test(upper)) embalagem += " + copo dosador";
      if (/GOT/.test(upper)) embalagem = embalagem.replace("frasco", "frasco conta-gotas");
      if (/\+\s*COL/.test(upper)) embalagem += " + colher dosadora";
    }
  }

  if (!embalagem && unidades) {
    embalagem = `${unidades.qtd} ${unidades.nome}${unidades.qtd > 1 ? "s" : ""}`;
  }

  if (!embalagem) {
    const m3 = upper.match(/X\s*(\d+)\s*$/);
    if (m3) {
      const qty = m3[1];
      embalagem = `${qty} unidade${parseInt(qty) > 1 ? "s" : ""}`;
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

  return { concentracao, forma, embalagem, unidades };
}

const parseCache = new Map<string, Apresentacao>();
export function parseApresentacao(raw: string): Apresentacao {
  let parsed = parseCache.get(raw);
  if (!parsed) {
    parsed = parseApresentacaoUncached(raw);
    parseCache.set(raw, parsed);
  }
  return parsed;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "COZAAR" → "Cozaar" */
export function brandName(produto: string): string {
  return produto.charAt(0) + produto.slice(1).toLowerCase();
}

export function buildCardTitle(produto: string, parsed: Apresentacao): string {
  const parts: string[] = [produto];
  if (parsed.concentracao) {
    parts.push(parsed.concentracao.replace(/\s+/g, ""));
  }
  const suffix = parsed.embalagem ? capitalize(parsed.embalagem) : parsed.forma;
  return suffix ? `${parts.join(" ")} — ${suffix}` : parts.join(" ");
}

// Same strength, different spelling: "(50 + 12,5) MG", "50 MG + 12,5 MG" and
// "50,0MG+12,50MG" all become "50MG+12.5MG".
function concentrationKey(conc: string): string {
  const parts: string[] = [];
  let pending: number[] = [];
  for (const m of conc.toUpperCase().matchAll(/(\d+(?:[.,]\d+)?)|((?:MUI|MCG|MG|ML|UI|ME|G|U|%)(?:\s*\/\s*[A-Z]+)?)/g)) {
    if (m[1]) {
      pending.push(parseFloat(m[1].replace(",", ".")));
    } else {
      const unit = m[2].replace(/\s+/g, "");
      parts.push(...pending.map((n) => `${n}${unit}`));
      pending = [];
    }
  }
  parts.push(...pending.map(String));
  return parts.join("+");
}

export function getGroupKey(med: Med): string {
  const parsed = parseApresentacao(med.apresentacao);
  const sub = stripAccents(med.substancia).toUpperCase().replace(/\s+/g, " ").trim();
  const conc = concentrationKey(parsed.concentracao);
  const form = parsed.forma.toUpperCase();
  if (!sub && !conc && !form) return `_${med.id}`;
  return `${sub}|${conc}|${form}`;
}

/** Box price for an ICMS rate; falls back to the nearest published rate. */
export function priceAt(med: Med, rate: string): number | null {
  return med.pmc[rate] ?? med.pmc["18%"] ?? med.pmc["17%"] ?? med.pmc["0%"] ?? null;
}

/** Price per tablet/capsule, when the box has a countable number of units. */
export function unitPriceAt(med: Med, rate: string): number | null {
  const u = parseApresentacao(med.apresentacao).unidades;
  const price = priceAt(med, rate);
  return u && price !== null ? price / u.qtd : null;
}

export const TIPO_LABEL: Record<string, string> = {
  "Novo": "Referência",
};

export function tarjaLabel(tarja: string): string {
  if (!tarja) return "";
  if (/sem tarja/i.test(tarja)) return "Sem tarja (venda livre)";
  if (/preta/i.test(tarja)) return "Tarja preta (receita especial retida)";
  if (/sob restri/i.test(tarja)) return "Tarja vermelha (receita retida)";
  if (/vermelha/i.test(tarja)) return "Tarja vermelha (venda sob prescrição)";
  return tarja;
}
