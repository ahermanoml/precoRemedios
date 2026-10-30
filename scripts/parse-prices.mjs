import XLSX from "xlsx";
import { writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = resolve(__dirname, "pmc_raw.xlsx");
const OUTPUT_FILE = resolve(__dirname, "../public/data/meds.json");
const META_FILE = resolve(__dirname, "../src/data/cmed-meta.json");

// A lista da CMED tem ~22–23 mil apresentações com PMC. Bem menos que isso
// indica planilha cortada ou formato novo — melhor falhar do que publicar.
const MIN_MEDS = 15000;

if (!existsSync(INPUT_FILE)) {
  console.error(
    "❌ Excel file not found at",
    INPUT_FILE,
    "\nDownload it first with: node scripts/fetch-cmed.mjs"
  );
  process.exit(1);
}

console.log("📖 Reading Excel file...");
const wb = XLSX.readFile(INPUT_FILE);

// The data sheet changed position over time (single sheet with a long preamble
// until early 2026, separate "Cabeçalho" + "Lista PMC" sheets since then), so
// look for the header row in every sheet instead of assuming one.
let raw = null;
let headerIdx = -1;
let publicadaEm = null;
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    raw: false,
  });
  for (let i = 0; i < Math.min(rows.length, 80); i++) {
    const row = rows[i] || [];
    const text = row.join(" ");
    const pub = text.match(/Publicada em (\d{2})\/(\d{2})\/(\d{4})/);
    if (pub && !publicadaEm) publicadaEm = `${pub[3]}-${pub[2]}-${pub[1]}`;
    const upper = row.map((h) => (h ?? "").toString().trim().toUpperCase());
    if (headerIdx === -1 && upper.includes("PRODUTO") && upper.includes("PMC 18 %")) {
      raw = rows;
      headerIdx = i;
    }
  }
}

if (!raw) {
  console.error("❌ Could not find header row");
  process.exit(1);
}
if (!publicadaEm) {
  console.error("❌ Could not find the publication date (\"Publicada em dd/mm/aaaa\")");
  process.exit(1);
}

const headers = raw[headerIdx];
console.log(`📋 Found ${headers.length} columns at row ${headerIdx}`);

function colIdx(name) {
  const idx = headers.findIndex(
    (h) =>
      h &&
      h.toString().trim().replace(/\s+/g, " ").toUpperCase() === name.toUpperCase()
  );
  if (idx === -1) {
    console.error(`❌ Column not found: ${name}`);
    process.exit(1);
  }
  return idx;
}

// Every ICMS rate the CMED publishes (the "ALC" columns, for Áreas de Livre
// Comércio, are left out). Order here is the order of `rates` in meds.json.
const RATES = [
  "0%", "12%", "17%", "17,5%", "18%", "19%", "19,5%",
  "20%", "20,5%", "21%", "22%", "22,5%", "23%",
];
const pmcIndices = RATES.map((r) => colIdx(r === "0%" ? "PMC 0 %" : `PMC ${r.replace("%", " %")}`));

const COL = {
  substancia: colIdx("SUBSTÂNCIA"),
  laboratorio: colIdx("LABORATÓRIO"),
  ggrem: colIdx("CÓDIGO GGREM"),
  ean: colIdx("EAN 1"),
  produto: colIdx("PRODUTO"),
  apresentacao: colIdx("APRESENTAÇÃO"),
  classe: colIdx("CLASSE TERAPÊUTICA"),
  tipo: colIdx("TIPO DE PRODUTO (STATUS DO PRODUTO)"),
  restricao: colIdx("RESTRIÇÃO HOSPITALAR"),
  icms0: colIdx("ICMS 0%"),
  tarja: colIdx("TARJA"),
};

// "2098,20" / "1.234,56" / 12.5 → number with 2 decimals
function parsePrice(val) {
  if (val == null) return null;
  if (typeof val === "number") return Math.round(val * 100) / 100;
  let s = val.toString().replace(/\s/g, "");
  if (s === "" || s === "-") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function clean(val) {
  if (val == null) return "";
  return val.toString().replace(/\s+/g, " ").trim();
}

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// "FOSFATO SÓDICO DE PREDNISOLONA;CLORIDRATO DE NAFAZOLINA"
//   → "Fosfato Sódico de Prednisolona + Cloridrato de Nafazolina"
const LOWER_WORDS = new Set(["DE", "DA", "DO", "DAS", "DOS", "EM", "COM", "SOB", "OU"]);
const KEEP_WORDS = new Set(["HPV", "BCG", "HBS", "NAD", "OMV", "CRM", "DNA", "RNA", "HIV", "TC", "SV"]);

function titleWord(word, isFirst) {
  if (!word) return word;
  if (!isFirst && LOWER_WORDS.has(word)) return word.toLowerCase();
  if (KEEP_WORDS.has(word) || word.length === 1 || word.includes(".")) return word;
  return word
    .split("-")
    .map((part) =>
      /\d/.test(part) ? part : part.charAt(0) + part.slice(1).toLowerCase()
    )
    .join("-");
}

function formatSubstance(s) {
  return s
    .split(";")
    .map((part) =>
      part
        .trim()
        .split(" ")
        .map((w, i) => {
          const m = w.match(/^(\(?)(.*?)(\)?,?)$/);
          return m[1] + titleWord(m[2], i === 0) + m[3];
        })
        .join(" ")
    )
    .filter(Boolean)
    .join(" + ");
}

console.log("🔄 Processing rows...");
const rows = [];
for (let i = headerIdx + 1; i < raw.length; i++) {
  const row = raw[i];
  if (!row || row.length < 5) continue;

  const produto = clean(row[COL.produto]);
  if (!produto) continue;

  const pmc = pmcIndices.map((idx) => parsePrice(row[idx]));
  // Sem PMC = produto de uso restrito a hospitais/clínicas, fora do varejo
  if (pmc.every((p) => p === null)) continue;

  rows.push({ row, produto, pmc });
}

// The same substance shows up spelled with and without accents
// ("LOSARTANA POTÁSSICA" / "LOSARTANA POTASSICA"). Pick one spelling per
// accent-insensitive key — the accented one, else the most frequent — so the
// site doesn't split one medicine into two groups.
const spellings = new Map();
for (const { row } of rows) {
  const s = clean(row[COL.substancia]).toUpperCase();
  const key = stripAccents(s);
  if (!spellings.has(key)) spellings.set(key, new Map());
  const counts = spellings.get(key);
  counts.set(s, (counts.get(s) || 0) + 1);
}
const accentCount = (s) => s.normalize("NFD").length - s.normalize("NFC").length;
const canonical = new Map();
for (const [key, counts] of spellings) {
  const best = [...counts.entries()].sort(
    (a, b) => accentCount(b[0]) - accentCount(a[0]) || b[1] - a[1]
  )[0][0];
  canonical.set(key, formatSubstance(best));
}

// Repeated strings go into lookup tables; each med row stores indices.
function table() {
  const values = [];
  const index = new Map();
  return {
    values,
    id(v) {
      if (!index.has(v)) {
        index.set(v, values.length);
        values.push(v);
      }
      return index.get(v);
    },
  };
}
const dicts = {
  substancia: table(),
  laboratorio: table(),
  classe: table(),
  tipo: table(),
  tarja: table(),
};

const meds = rows.map(({ row, produto, pmc }) => {
  const substancia = canonical.get(stripAccents(clean(row[COL.substancia]).toUpperCase()));
  const ean = clean(row[COL.ean]);
  const tarja = clean(row[COL.tarja]).replace(/\s*\(\*\)$/, "").replace(/^-$/, "");
  return [
    clean(row[COL.ggrem]),
    dicts.substancia.id(substancia),
    dicts.laboratorio.id(clean(row[COL.laboratorio])),
    produto,
    clean(row[COL.apresentacao]),
    dicts.classe.id(clean(row[COL.classe])),
    dicts.tipo.id(clean(row[COL.tipo])),
    ean === "-" ? "" : ean,
    dicts.tarja.id(tarja),
    (clean(row[COL.restricao]) === "Sim" ? 1 : 0) | (clean(row[COL.icms0]) === "Sim" ? 2 : 0),
    pmc,
  ];
});

console.log(`✅ Parsed ${meds.length} medications (publicada em ${publicadaEm})`);
if (meds.length < MIN_MEDS) {
  console.error(`❌ Only ${meds.length} medications — expected at least ${MIN_MEDS}. Not writing.`);
  process.exit(1);
}

// Layout documented in src/lib/meds.ts (decodeMeds)
const out = {
  publicadaEm,
  rates: RATES,
  dicts: Object.fromEntries(Object.entries(dicts).map(([k, t]) => [k, t.values])),
  meds,
};
const json = JSON.stringify(out);
writeFileSync(OUTPUT_FILE, json, "utf-8");
writeFileSync(
  META_FILE,
  JSON.stringify({ publicadaEm, total: meds.length }, null, 2) + "\n",
  "utf-8"
);
const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1);
console.log(`💾 Wrote ${OUTPUT_FILE} (${sizeMB} MB) and ${META_FILE}`);
