import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "vettracker-dev-secret-change-in-production"
);
export const COOKIE_NAME = "vt_session";

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
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
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
  const row = db()
    .prepare("SELECT id, email, name, role, vet_id, phone, address FROM users WHERE id = ?")
    .get(uid) as SessionUser | undefined;
  return row ?? null;
}

/** Guard for API routes: returns the user or throws a Response-shaped error. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
