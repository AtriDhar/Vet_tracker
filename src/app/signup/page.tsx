"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Field, inputCls, Card } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/signup", { method: "POST", body: JSON.stringify(form) });
      router.push("/pets/new");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-bold text-stone-900">Create your account</h1>
        <p className="mt-1 text-sm text-stone-500">
          One account, all your pets — logs, alerts, bookings and reports.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Your name">
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <input className={inputCls} type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
          </Field>
          <Field label="Phone (for vet visits)">
            <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Address (for home-visit vets)">
            <input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-500">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-teal-700 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
