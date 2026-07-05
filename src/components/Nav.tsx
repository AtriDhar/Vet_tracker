"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: number;
  created_at: string;
}

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vets", label: "Find a Vet" },
  { href: "/appointments", label: "Appointments" },
  { href: "/toxicity", label: "Toxicity Check" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [role, setRole] = useState<string>("owner");
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ notifications: Notification[]; unread: number }>("/api/notifications");
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      /* signed out */
    }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(load, 0); // defer initial fetch out of the effect body
    api<{ user: { role: string } }>("/api/auth/me").then((d) => setRole(d.user.role)).catch(() => {});
    const t = setInterval(load, 30_000); // in-app notification polling
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api("/api/notifications", { method: "PATCH" });
      setUnread(0);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold text-teal-800">
          <span className="text-xl">🐾</span> VetTracker
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {(role === "vet" ? [{ href: "/vet-portal", label: "Triage Queue" }] : LINKS).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? "bg-teal-50 text-teal-800"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative" ref={panelRef}>
            <button
              onClick={toggle}
              className="relative rounded-full p-2 text-lg hover:bg-stone-100"
              aria-label="Notifications"
            >
              🔔
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Notifications
                </div>
                {items.length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-stone-500">Nothing yet.</div>
                )}
                {items.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-3 py-2 hover:bg-stone-50 ${n.read ? "opacity-70" : ""}`}
                  >
                    <div className="text-sm font-medium text-stone-800">{n.title}</div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-stone-500">{n.body}</div>}
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-stone-400">
                      {fmtDateTime(n.created_at)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Sign out
          </button>
        </div>
      </div>
      {/* mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-stone-100 px-2 py-1 md:hidden">
        {(role === "vet" ? [{ href: "/vet-portal", label: "Triage Queue" }] : LINKS).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
              pathname.startsWith(l.href) ? "bg-teal-50 text-teal-800" : "text-stone-600"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
