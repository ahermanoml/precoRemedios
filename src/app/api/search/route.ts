import { NextRequest, NextResponse } from "next/server";
import Fuse from "fuse.js";
import medsData from "../../../../public/data/meds.json";

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

const meds: Med[] = medsData as Med[];

function relevancePenalty(med: Med, query: string): number {
  const apr = med.apresentacao.toUpperCase();
  const q = query.trim();
  const qLower = q.toLowerCase();
  const querySpecifiesInjection = /\b(inj|amp|ampola|seringa|ser preenc)/i.test(q);
  const querySpecifiesQuantity = /\d{2,}/.test(q);
  let penalty = 0;

  if (!querySpecifiesInjection) {
    const ampMatch = apr.match(/(\d+)\s*(?:AMP|SER PREENC|SER|FA)\b/);
    if (ampMatch) {
      const qty = parseInt(ampMatch[1]);
      if (qty >= 50) penalty += 0.5;
      else if (qty >= 10) penalty += 0.25;
    }
  }

  if (!querySpecifiesQuantity) {
    const tail = apr.match(/X\s*(\d+)\s*(?:\(EMB HOSP\))?\s*$/);
    if (tail) {
      const qty = parseInt(tail[1]);
      if (qty >= 200) penalty += 0.4;
      else if (qty >= 100) penalty += 0.2;
      else if (qty >= 60) penalty += 0.1;
    }
  }

  if (/EMB HOSP/.test(apr)) penalty += 0.3;
  if (med.restricaoHospitalar === "Sim") penalty += 0.2;

  if (
    qLower &&
    !/[\s+]/.test(qLower) &&
    med.substancia.includes("+") &&
    !med.produto.toLowerCase().includes(qLower)
  ) {
    penalty += 0.2;
  }

  return penalty;
}

let fuse: Fuse<Med> | null = null;

function getIndex() {
  if (fuse) return fuse;

  fuse = new Fuse(meds, {
    keys: [
      { name: "produto", weight: 3 },
      { name: "substancia", weight: 2 },
      { name: "laboratorio", weight: 1 },
    ],
    threshold: 0.3,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 2,
  });

  return fuse;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "30"),
    100
  );

  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const fuse = getIndex();
  const raw = fuse.search(q, { limit: Math.min(limit * 2, 200) });
  const results = raw
    .map((r) => ({
      item: r.item,
      score: (r.score ?? 0) + relevancePenalty(r.item, q),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return NextResponse.json({
    results: results.map((r) => r.item),
    total: results.length,
  });
}
