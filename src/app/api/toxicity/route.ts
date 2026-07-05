import { NextRequest, NextResponse } from "next/server";
import { searchToxicity, TOXICITY } from "@/lib/data/toxicity";

// Deliberately public — a poisoning lookup should never sit behind a login wall.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [], total: TOXICITY.length });
  return NextResponse.json({ results: searchToxicity(q), total: TOXICITY.length });
}
