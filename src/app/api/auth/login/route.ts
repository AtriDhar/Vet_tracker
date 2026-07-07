import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const d = await db();
  const user = await d.get<{ id: number; password_hash: string; role: string }>(
    "SELECT id, password_hash, role FROM users WHERE email = ?",
    [(email ?? "").toLowerCase()]
  );
  if (!user || !bcrypt.compareSync(password ?? "", user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(COOKIE_NAME, await signToken(user.id), COOKIE_OPTIONS);
  return res;
}
