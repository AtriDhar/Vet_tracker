import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

// In production a real JWT_SECRET is mandatory — fail fast at first use
// rather than silently signing sessions with a public default.
function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable must be set in production.");
    }
    return new TextEncoder().encode("vettracker-dev-secret-change-in-production");
  }
  return new TextEncoder().encode(s);
}

export const COOKIE_NAME = "vt_session";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 86400,
};

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: "owner" | "vet";
  vet_id: number | null;
  phone: string | null;
  address: string | null;
}

export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.uid === "number" ? payload.uid : null;
  } catch {
    return null;
  }
}

/** Read the session cookie and return the full user row, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const uid = await verifyToken(token);
  if (!uid) return null;
  const d = await db();
  const row = await d.get<SessionUser>(
    "SELECT id, email, name, role, vet_id, phone, address FROM users WHERE id = ?",
    [uid]
  );
  return row ?? null;
}
