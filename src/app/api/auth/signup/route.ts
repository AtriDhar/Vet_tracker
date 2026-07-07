import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";
import { notify } from "@/lib/service";

export async function POST(req: NextRequest) {
  const { email, password, name, phone, address } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: "Email, password and name are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const d = await db();
  const existing = await d.get("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }
  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid: id } = await d.run(
    "INSERT INTO users (email, password_hash, name, phone, address, role) VALUES (?,?,?,?,?,'owner')",
    [email.toLowerCase(), hash, name, phone ?? null, address ?? null]
  );
  await notify(d, id, "system", "Welcome to VetTracker 🐾",
    "Add your first pet, then log daily — the early-warning engine needs ~3 days of logs to learn a baseline.",
    "/pets/new");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await signToken(id), COOKIE_OPTIONS);
  return res;
}
