import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const emergency = req.nextUrl.searchParams.get("emergency");
  const d = await db();
  const vets = emergency
    ? await d.all("SELECT * FROM vets WHERE emergency = 1 ORDER BY rating DESC")
    : await d.all("SELECT * FROM vets ORDER BY emergency DESC, rating DESC");
  return NextResponse.json({ vets });
}
