import XLSX from "xlsx";
import { writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = resolve(__dirname, "pmc_raw.xlsx");
const OUTPUT_FILE = resolve(__dirname, "../public/data/meds.json");

if (!existsSync(INPUT_FILE)) {
  console.error(
    "❌ Excel file not found at",
    INPUT_FILE,
    "\nDownload it first with: curl -L -o scripts/pmc_raw.xlsx <ANVISA_URL>"
  );
  process.exit(1);
}

console.log("📖 Reading Excel file...");
const wb = XLSX.readFile(INPUT_FILE);
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Find header row (first row with 30+ columns)
let headerIdx = -1;
for (let i = 0; i < 60; i++) {
  if (raw[i] && raw[i].length > 30) {
    headerIdx = i;
    break;
  }
}

if (headerIdx === -1) {
  console.error("❌ Could not find header row");
  process.exit(1);
}

const headers = raw[headerIdx];
console.log(`📋 Found ${headers.length} columns at row ${headerIdx}`);

// Map column indices by name
function colIdx(name) {
  const idx = headers.findIndex(
    (h) => h && h.toString().trim().toUpperCase() === name.toUpperCase()
  );
  return idx;
}

// Find PMC columns for common ICMS rates
const pmcRates = [
  { label: "0%", col: "PMC 0 %" },
  { label: "12%", col: "PMC 12 %" },
  { label: "17%", col: "PMC 17 %" },
  { label: "18%", col: "PMC 18 %" },
  { label: "19%", col: "PMC 19 %" },
  { label: "20%", col: "PMC 20 %" },
  { label: "21%", col: "PMC 21 %" },
  { label: "22%", col: "PMC 22 %" },
];

const pmcIndices = pmcRates
  .map((r) => ({ label: r.label, idx: colIdx(r.col) }))
  .filter((r) => r.idx !== -1);

function parsePrice(val) {
  if (val == null || val === "" || val === "-") return null;
  const s = val.toString().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function clean(val) {
  if (val == null) return "";
  return val.toString().trim();
}

console.log("🔄 Processing rows...");
const meds = [];

for (let i = headerIdx + 1; i < raw.length; i++) {
  const row = raw[i];
  if (!row || row.length < 5) continue;

  const produto = clean(row[colIdx("PRODUTO")]);
  if (!produto) continue;

  const prices = {};
  for (const { label, idx } of pmcIndices) {
    const p = parsePrice(row[idx]);
    if (p !== null) prices[label] = p;
  }

  // Skip rows with no prices at all
  if (Object.keys(prices).length === 0) continue;

  meds.push({
    id: meds.length,
    substancia: clean(row[colIdx("SUBSTÂNCIA")]),
    laboratorio: clean(row[colIdx("LABORATÓRIO")]),
    produto,
    apresentacao: clean(row[colIdx("APRESENTAÇÃO")]),
    classeTerapeutica: clean(row[colIdx("CLASSE TERAPÊUTICA")]),
    tipo: clean(row[colIdx("TIPO DE PRODUTO (STATUS DO PRODUTO)")]),
    regime: clean(row[colIdx("REGIME DE PREÇO")]),
    ean: clean(row[colIdx("EAN 1")]),
    tarja: clean(row[colIdx("TARJA")]),
    restricaoHospitalar: clean(row[colIdx("RESTRIÇÃO HOSPITALAR")]),
    pmc: prices,
  });
}

console.log(`✅ Parsed ${meds.length} medications`);

writeFileSync(OUTPUT_FILE, JSON.stringify(meds), "utf-8");
const sizeMB = (Buffer.byteLength(JSON.stringify(meds)) / 1024 / 1024).toFixed(
  1
);
console.log(`💾 Wrote ${OUTPUT_FILE} (${sizeMB} MB)`);
