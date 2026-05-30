"use client";

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Funnel, FunnelChart, LabelList,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ChartSpec } from "@/store/dashboardStore";
import type { DashboardTheme } from "@/app/api/theme/route";
import { CHART_COLORS, formatNumber } from "@/lib/utils";

interface ChartRendererProps {
  spec: ChartSpec;
  data: Record<string, unknown>[];
  isSelected?: boolean;
  theme?: DashboardTheme | null;
}

// Light-theme tooltip style
const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  color: "#111827",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

// Light-theme axis and grid colors
const GRID_COLOR = "#f3f4f6";
const AXIS_TICK_COLOR = "#9ca3af";

function aggregateData(
  rows: Record<string, unknown>[],
  xField: string,
  yField: string,
  aggregation: ChartSpec["aggregation"] = "sum"
): { name: string; value: number }[] {
  // For count: group by xField and count ALL rows per group (strings included)
  if (aggregation === "count") {
    const countMap = new Map<string, number>();
    for (const row of rows) {
      const key = String(row[xField] ?? "Unknown");
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
    return Array.from(countMap.entries()).map(([name, value]) => ({ name, value }));
  }

  const map = new Map<string, number[]>();
  for (const row of rows) {
    const key = String(row[xField] ?? "Unknown");
    const val = Number(row[yField] ?? 0);
    if (!isNaN(val)) {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(val);
    }
  }
  return Array.from(map.entries()).map(([name, vals]) => {
    let value = 0;
    if (aggregation === "sum") value = vals.reduce((a, b) => a + b, 0);
    else if (aggregation === "avg") value = vals.reduce((a, b) => a + b, 0) / vals.length;
    else if (aggregation === "max") value = Math.max(...vals);
    else if (aggregation === "min") value = Math.min(...vals);
    return { name, value: Math.round(value * 100) / 100 };
  });
}

function computeKPI(rows: Record<string, unknown>[], field: string, aggregation: ChartSpec["aggregation"] = "sum") {
  // count = total number of rows — works on ANY field type including strings like Order ID
  if (aggregation === "count") return rows.length;

  const vals = rows.map((r) => Number(r[field] ?? 0)).filter((v) => !isNaN(v) && v !== 0);
  if (vals.length === 0) {
    // Fallback: if field has no numeric values, return row count so KPIs never show 0
    return rows.length;
  }
  if (aggregation === "sum") return vals.reduce((a, b) => a + b, 0);
  if (aggregation === "avg") return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (aggregation === "max") return Math.max(...vals);
  if (aggregation === "min") return Math.min(...vals);
  return 0;
}

export function ChartRenderer({ spec, data, theme }: ChartRendererProps) {
  // Merge theme colours over defaults
  const chartColors = theme?.chartColors ?? CHART_COLORS;
  const gridColor   = theme?.chartGrid   ?? "#f3f4f6";
  const axisColor   = theme?.chartAxis   ?? "#9ca3af";
  const tooltipStyle = {
    backgroundColor: theme?.tooltipBg   ?? "#ffffff",
    border:         `1px solid ${theme?.chartGrid ?? "#e5e7eb"}`,
    borderRadius:   "10px",
    color:          theme?.tooltipText  ?? "#111827",
    fontSize:       "12px",
    boxShadow:      "0 4px 16px rgba(0,0,0,0.08)",
  };

  const color = spec.color || chartColors[0];

  /* ── KPI Card ───────────────────────────────────── */
  if (spec.type === "kpi_card") {
    const field = spec.value_field || spec.y_field || "";
    const value = computeKPI(data, field, spec.aggregation);
    const halfIdx = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, halfIdx).map((r) => Number(r[field] ?? 0)).filter((v) => !isNaN(v));
    const secondHalf = data.slice(halfIdx).map((r) => Number(r[field] ?? 0)).filter((v) => !isNaN(v));
    const firstSum = firstHalf.reduce((a, b) => a + b, 0);
    const secondSum = secondHalf.reduce((a, b) => a + b, 0);
    const trend = firstSum > 0 ? ((secondSum - firstSum) / firstSum) * 100 : 0;

    const textPrimary = theme?.cardText ?? "#111827";
    const textMuted   = theme?.cardTextMuted ?? "#9ca3af";

    return (
      <div className="w-full h-full flex flex-col justify-center px-5">
        <p className="text-xs mb-1.5 truncate font-medium" style={{ color: textMuted }}>{spec.title}</p>
        <p className="text-4xl font-bold tracking-tight" style={{ color }}>
          {formatNumber(value)}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : trend < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4" style={{ color: textMuted }} />
          )}
          <span className={`text-xs font-semibold ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : ""}`}
            style={trend === 0 ? { color: textMuted } : {}}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
          <span className="text-xs" style={{ color: textMuted }}>vs prior period</span>
        </div>
        <p className="text-xs mt-1 uppercase tracking-wide" style={{ color: textMuted }}>{field}</p>
      </div>
    );
  }

  /* ── Table ──────────────────────────────────────── */
  if (spec.type === "table") {
    const cols = Object.keys(data[0] || {}).slice(0, 6);
    const textPrimary = theme?.cardText ?? "#111827";
    const textMuted   = theme?.cardTextMuted ?? "#6b7280";
    const bgHeader    = theme?.cardHeaderBg ?? "#ffffff";
    const borderColor = theme?.cardBorder ?? "#f3f4f6";
    return (
      <div className="w-full h-full overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="text-left px-3 py-2 font-semibold sticky top-0 uppercase tracking-wide text-[10px]"
                  style={{ color: textMuted, borderBottom: `1px solid ${borderColor}`, background: bgHeader }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                {cols.map((c) => (
                  <td key={c} className="px-3 py-1.5 truncate max-w-[120px]" style={{ color: textPrimary }}>
                    {String(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const xField = spec.x_field || "";
  const yField = spec.y_field || "";
  const aggregated = spec.type !== "scatter" ? aggregateData(data, xField, yField, spec.aggregation) : data;

  const commonAxis = {
    tick: { fill: axisColor, fontSize: 11 },
    axisLine: { stroke: gridColor },
    tickLine: false,
  };

  /* ── Bar ────────────────────────────────────────── */
  if (spec.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={aggregated} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" {...commonAxis} />
          <YAxis {...commonAxis} tickFormatter={formatNumber} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v), yField]} />
          <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  /* ── Line ───────────────────────────────────────── */
  if (spec.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={aggregated} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" {...commonAxis} />
          <YAxis {...commonAxis} tickFormatter={formatNumber} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v), yField]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  /* ── Area ───────────────────────────────────────── */
  if (spec.type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={aggregated} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`grad-${spec.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" {...commonAxis} />
          <YAxis {...commonAxis} tickFormatter={formatNumber} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v), yField]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#grad-${spec.id})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  /* ── Pie / Donut ────────────────────────────────── */
  if (spec.type === "pie" || spec.type === "donut") {
    const pieData = aggregated.slice(0, 8);
    const innerRadius = spec.type === "donut" ? "55%" : "0%";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius="70%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {pieData.map((_, idx) => (
              <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v)]} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ color: theme?.cardTextMuted ?? "#6b7280", fontSize: 11 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  /* ── Scatter ────────────────────────────────────── */
  if (spec.type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={xField} {...commonAxis} name={xField} />
          <YAxis dataKey={yField} {...commonAxis} name={yField} tickFormatter={formatNumber} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3", stroke: gridColor }} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Scatter data={data.slice(0, 200) as any} fill={color} opacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  /* ── Funnel ─────────────────────────────────────── */
  if (spec.type === "funnel") {
    const funnelData = aggregated.slice(0, 6).map((d, i) => ({
      ...d,
      fill: chartColors[i % chartColors.length],
    }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v)]} />
          <Funnel dataKey="value" data={funnelData} isAnimationActive>
            {funnelData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList position="center" fill="white" fontSize={11} dataKey="name" />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-sm"
      style={{ color: theme?.cardTextMuted ?? "#9ca3af" }}>
      Unsupported chart type: {spec.type}
    </div>
  );
}
