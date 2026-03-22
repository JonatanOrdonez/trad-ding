"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import {
  ComposedChart,
  LineChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ChartRow } from "@/types/analysis";

interface PriceChartProps {
  symbol: string;
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${month}/${day}`;
}

function PriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs space-y-1 shadow-xl">
      <p className="text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-medium tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function RsiTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const rsi = payload[0].value;
  const color = rsi >= 70 ? "#f87171" : rsi <= 30 ? "#4ade80" : "#facc15";
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p style={{ color }}>
        RSI: <span className="font-medium tabular-nums">{rsi}</span>
      </p>
    </div>
  );
}

export function PriceChart({ symbol }: PriceChartProps) {
  const { dark } = useTheme();
  const gridColor = dark ? "#1f2937" : "#e5e7eb";
  const tickColor = dark ? "#4b5563" : "#9ca3af";

  const [rows, setRows] = useState<ChartRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    fetch(`/chart/${symbol}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail ?? `HTTP ${r.status}`);
        if (!d.rows?.length) throw new Error("No chart data");
        setRows(d.rows);
      })
      .catch((e: Error) => setError(e.message));
  }, [symbol]);

  if (error) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-600 italic py-2">
        Chart unavailable — {error}
      </p>
    );
  }

  if (!rows) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-400 dark:text-gray-600 text-xs">
        <svg className="animate-spin h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading chart…
      </div>
    );
  }

  const ticks = rows
    .filter((_, i) => i % 7 === 0)
    .map((r) => r.date);

  const prices = rows.map((r) => r.close);
  const minP = Math.min(...prices) * 0.995;
  const maxP = Math.max(...prices) * 1.005;

  return (
    <div className="space-y-1.5">
      {/* Price + SMAs */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 pb-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-600 font-semibold mb-2">
          Price · SMA 7 · SMA 20
        </p>
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={shortDate}
                tick={{ fill: tickColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[minP, maxP]}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)}
                tick={{ fill: tickColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip content={<PriceTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                name="Close"
                stroke="#6366f1"
                strokeWidth={1.5}
                fill="url(#priceGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "#6366f1" }}
              />
              <Line
                type="monotone"
                dataKey="sma_7"
                name="SMA 7"
                stroke="#f97316"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="sma_20"
                name="SMA 20"
                stroke="#22d3ee"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RSI */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 pb-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-600 font-semibold mb-2">
          RSI 14
        </p>
        <div style={{ width: "100%", height: 80 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={shortDate}
                tick={{ fill: tickColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[30, 50, 70]}
                tick={{ fill: tickColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<RsiTooltip />} />
              <ReferenceLine y={70} stroke="#f87171" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={30} stroke="#4ade80" strokeDasharray="3 3" strokeWidth={1} />
              <Line
                type="monotone"
                dataKey="rsi"
                name="RSI"
                stroke="#facc15"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 pt-1">
          <span className="text-[10px] text-red-400/70">── 70 Overbought</span>
          <span className="text-[10px] text-green-400/70">── 30 Oversold</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-1">
        {[
          { color: "#6366f1", label: "Close" },
          { color: "#f97316", label: "SMA 7" },
          { color: "#22d3ee", label: "SMA 20" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-500">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
