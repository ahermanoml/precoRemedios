// Baixa a lista de preços (PMC) mais recente publicada pela CMED/Anvisa para
// scripts/pmc_raw.xlsx. Depois rode `node scripts/parse-prices.mjs`.
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = resolve(__dirname, "pmc_raw.xlsx");
const BASE = "https://www.gov.br";
const PAGE = `${BASE}/anvisa/pt-br/assuntos/medicamentos/cmed/precos`;

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; medpreco-bot; +https://medpreco.com)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
}

const html = await (await get(PAGE)).text();
// e.g. /anvisa/.../arquivos/lista_pmc__20261009_115232673.xlsx/@@download/file
const links = [...html.matchAll(/href="([^"]*lista_pmc_[^"]*\.xlsx[^"]*)"/gi)].map((m) => m[1]);
if (links.length === 0) {
  console.error("❌ Nenhum link lista_pmc_*.xlsx encontrado em", PAGE);
  process.exit(1);
}
// The file name carries the publication timestamp; newest wins.
const latest = [...new Set(links)].sort().at(-1);
const url = latest.startsWith("http") ? latest : BASE + latest;

console.log("⬇️  Baixando", url);
const buf = Buffer.from(await (await get(url)).arrayBuffer());
if (buf.subarray(0, 2).toString() !== "PK") {
  console.error("❌ O arquivo baixado não é um .xlsx");
  process.exit(1);
}
writeFileSync(OUTPUT_FILE, buf);
console.log(`💾 ${OUTPUT_FILE} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
