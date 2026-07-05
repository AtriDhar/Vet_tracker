"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Field, inputCls, Card } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ role: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(res.role === "vet" ? "/vet-portal" : params.get("next") || "/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="font-display text-2xl font-bold text-stone-900">Welcome back</h1>
      <p className="mt-1 text-sm text-stone-500">Sign in to your VetTracker account.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
        <div className="font-semibold text-stone-700">Demo accounts</div>
        <div className="mt-1">
          Owner: <code className="font-mono">demo@vettracker.app</code> / <code className="font-mono">demo1234</code>
        </div>
        <div>
          Vet portal: <code className="font-mono">vet@vettracker.app</code> / <code className="font-mono">vet1234</code>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-stone-500">
        No account?{" "}
        <Link href="/signup" className="font-medium text-teal-700 hover:underline">
          Sign up
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
