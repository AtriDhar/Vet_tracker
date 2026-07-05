// Tiny client-side fetch helpers shared by all pages.

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return body as T;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d.length <= 10 ? d + "T00:00" : d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ageString(birth: string | null): string {
  if (!birth) return "age unknown";
  const ms = Date.now() - new Date(birth).getTime();
  const years = ms / (365.25 * 24 * 3600 * 1000);
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months`;
  return `${Math.floor(years)} yr${years >= 2 ? "s" : ""}`;
}

export const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
