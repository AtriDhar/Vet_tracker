import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export const SEVERITY_STYLES: Record<string, { badge: string; dot: string; label: string; emoji: string }> = {
  urgent: { badge: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500", label: "Urgent", emoji: "🔴" },
  watch: { badge: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500", label: "Watch", emoji: "🟡" },
  info: { badge: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-500", label: "Info", emoji: "🔵" },
};

export const TRIAGE_COPY: Record<string, { title: string; body: string; style: string }> = {
  home: {
    title: "🟢 Monitor at home",
    body: "No vet visit needed yet — follow the care tips below and keep logging daily.",
    style: "bg-emerald-50 border-emerald-200 text-emerald-900",
  },
  vet48: {
    title: "🟡 See a vet within 48 hours",
    body: "This pattern deserves professional eyes soon. Book a regular appointment below.",
    style: "bg-amber-50 border-amber-300 text-amber-900",
  },
  emergency: {
    title: "🔴 Emergency — act now",
    body: "Contact a 24-hour emergency clinic immediately. Do not wait for symptoms to improve.",
    style: "bg-rose-50 border-rose-300 text-rose-900",
  },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Button({
  children,
  onClick,
  href,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-stone-300",
    secondary: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-stone-600 hover:bg-stone-100",
  }[variant];
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${styles} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-700" />
    </div>
  );
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 px-6 py-12 text-center">
      <div className="text-4xl">{emoji}</div>
      <div className="font-semibold text-stone-800">{title}</div>
      <p className="max-w-sm text-sm text-stone-500">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
