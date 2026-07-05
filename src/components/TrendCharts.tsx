"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export interface LogRow {
  log_date: string;
  food_grams: number | null;
  water_ml: number | null;
  activity_min: number | null;
  weight_kg: number | null;
  sleep_hours: number | null;
}

const METRICS: { key: keyof LogRow; label: string; color: string; unit: string }[] = [
  { key: "water_ml", label: "Water intake", color: "#0e7490", unit: "ml" },
  { key: "food_grams", label: "Food intake", color: "#b45309", unit: "g" },
  { key: "weight_kg", label: "Weight", color: "#4d7c0f", unit: "kg" },
  { key: "activity_min", label: "Activity", color: "#7e22ce", unit: "min" },
];

function baselineOf(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null && x > 0);
  if (v.length < 3) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export default function TrendCharts({ logs }: { logs: LogRow[] }) {
  // logs arrive newest-first; charts want oldest-first
  const data = [...logs].reverse().map((l) => ({
    ...l,
    day: new Date(l.log_date + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {METRICS.map((m) => {
        const base = baselineOf(data.slice(0, -3).map((d) => d[m.key] as number | null));
        return (
          <div key={m.key} className="rounded-2xl border border-stone-200 bg-white p-3">
            <div className="mb-1 flex items-baseline justify-between px-1">
              <span className="text-sm font-semibold text-stone-700">{m.label}</span>
              {base && (
                <span className="text-xs text-stone-400">
                  baseline ≈ {Math.round(base * 10) / 10} {m.unit}
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(v) => [`${v} ${m.unit}`, m.label]}
                  contentStyle={{ fontSize: 12, borderRadius: 12 }}
                />
                {base && <ReferenceLine y={base} stroke="#a8a29e" strokeDasharray="4 4" />}
                <Line
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
