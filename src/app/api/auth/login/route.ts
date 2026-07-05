import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = db()
    .prepare("SELECT id, password_hash, role FROM users WHERE email = ?")
    .get((email ?? "").toLowerCase()) as { id: number; password_hash: string; role: string } | undefined;
  if (!user || !bcrypt.compareSync(password ?? "", user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(COOKIE_NAME, await signToken(user.id), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400,
  });
  return res;
}
