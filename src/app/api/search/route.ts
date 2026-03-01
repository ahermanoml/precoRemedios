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
  const results = fuse.search(q, { limit });

  return NextResponse.json({
    results: results.map((r) => r.item),
    total: results.length,
  });
}
