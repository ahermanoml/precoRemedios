import { NextRequest, NextResponse } from "next/server";
import { getMeds } from "@/lib/meds-server";
import { createSearchIndex, searchMeds, type SearchIndex } from "@/lib/search";

let index: SearchIndex | null = null;

// GET /api/search?q=losartana&limit=30 — same search as the site
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "30") || 30,
    100
  );

  if (q.length < 2) {
    return NextResponse.json({ results: [], total: 0 });
  }

  index ??= createSearchIndex(getMeds());
  const { results, aproximado } = searchMeds(index, q);

  return NextResponse.json({
    results: results.slice(0, limit),
    total: results.length,
    aproximado,
  });
}
