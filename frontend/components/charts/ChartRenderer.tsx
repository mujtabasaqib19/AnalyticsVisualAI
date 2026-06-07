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
import {
  TABLE_ROW_LIMIT, BAR_CATEGORY_LIMIT, PIE_SLICE_LIMIT, SCATTER_POINT_LIMIT,
  FUNNEL_STAGE_LIMIT, HEATMAP_ROW_LIMIT, HEATMAP_COL_LIMIT,
} from "@/lib/constants";

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

const NO_DATA = (muted: string) => (
  <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: muted }}>
    No data available
  </div>
);

export function ChartRenderer({ spec, data, theme }: ChartRendererProps) {
  const muted = theme?.cardTextMuted ?? "#9ca3af";

  if (!data.length) return NO_DATA(muted);

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
            {data.slice(0, TABLE_ROW_LIMIT).map((row, i) => (
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

  // For bar/line/area: detect if x-axis is time-series (contains 4-digit year) —
  // if so, keep chronological order; otherwise sort by value desc and show top N.
  const isTimeSeries = aggregated.length > 0 && /\d{4}/.test(String(aggregated[0]?.name ?? ""));
  const displayData = (() => {
    if (spec.type === "bar" || spec.type === "line" || spec.type === "area") {
      const limit = spec.top_n ?? BAR_CATEGORY_LIMIT;
      if (isTimeSeries) {
        // keep original chronological order, just cap to limit
        return aggregated.slice(0, limit);
      }
      // sort descending by value, take top N
      return [...aggregated].sort((a, b) => (b as {value:number}).value - (a as {value:number}).value).slice(0, limit);
    }
    return aggregated;
  })();

  const commonAxis = {
    tick: { fill: axisColor, fontSize: 11 },
    axisLine: { stroke: gridColor },
    tickLine: false,
  };

  if (!aggregated.length && !["scatter", "kpi_card", "table", "gauge", "heatmap"].includes(spec.type)) {
    return NO_DATA(muted);
  }

  /* ── Bar ───────────────────────────────────────────────────────── */
  if (spec.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={displayData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="name" {...commonAxis} />
          <YAxis {...commonAxis} tickFormatter={formatNumber} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v), yField]} />
          <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  /* ── Line ───────────────────────────────────────────────────────── */
  if (spec.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
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
    if (!aggregated.length) return NO_DATA(muted);

    // Sort by value desc, then apply top_n (or PIE_SLICE_LIMIT as default)
    const sorted = [...aggregated].sort((a, b) => (b as {value:number}).value - (a as {value:number}).value);
    const limit = spec.top_n ?? PIE_SLICE_LIMIT;
    const topSlices = sorted.slice(0, limit);
    const rest = sorted.slice(limit);
    const otherValue = rest.reduce((sum, d) => sum + (d as {value:number}).value, 0);
    const pieData = otherValue > 0
      ? [...topSlices, { name: "Other", value: Math.round(otherValue * 100) / 100 }]
      : topSlices;

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
          <Scatter data={data.slice(0, SCATTER_POINT_LIMIT) as any} fill={color} opacity={0.65} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  /* ── Funnel ─────────────────────────────────────── */
  if (spec.type === "funnel") {
    if (!aggregated.length) return NO_DATA(muted);
    const funnelData = aggregated.slice(0, FUNNEL_STAGE_LIMIT).map((d, i) => ({
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

  /* ── Gauge ──────────────────────────────────────── */
  if (spec.type === "gauge") {
    const field = spec.value_field || spec.y_field || "";
    const value = computeKPI(data, field, spec.aggregation);
    const vals = data.map((r) => Number(r[field] ?? 0)).filter((v) => !isNaN(v) && v > 0);
    const maxVal = vals.length ? Math.max(...vals) : 1;
    const pct = Math.min(Math.max(value / maxVal, 0), 1);
    const gaugeData = [
      { value: pct, fill: color },
      { value: 1 - pct, fill: gridColor },
    ];
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="relative w-full" style={{ height: "60%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                startAngle={180}
                endAngle={0}
                cx="50%"
                cy="90%"
                innerRadius="55%"
                outerRadius="85%"
                dataKey="value"
                strokeWidth={0}
              >
                {gaugeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold" style={{ color }}>{formatNumber(value)}</p>
          <p className="text-xs mt-1" style={{ color: axisColor }}>{field}</p>
          <p className="text-[10px] mt-0.5" style={{ color: axisColor }}>{Math.round(pct * 100)}% of max</p>
        </div>
      </div>
    );
  }

  /* ── Heatmap ─────────────────────────────────── */
  if (spec.type === "heatmap") {
    const rowKeys = Array.from(new Set(data.map((r) => String(r[xField] ?? "")))).slice(0, HEATMAP_ROW_LIMIT);
    const numCols = Object.keys(data[0] || {})
      .filter((k) => k !== xField && !isNaN(Number(data[0][k])))
      .slice(0, HEATMAP_COL_LIMIT);

    if (!numCols.length) {
      return (
        <div className="w-full h-full flex items-center justify-center text-sm"
          style={{ color: axisColor }}>
          No numeric columns for heatmap
        </div>
      );
    }

    const cellMap: Record<string, Record<string, number>> = {};
    const allVals: number[] = [];
    for (const row of rowKeys) {
      cellMap[row] = {};
      for (const col of numCols) {
        const rowData = data.filter((r) => String(r[xField]) === row);
        const val = rowData.reduce((s, r) => s + Number(r[col] ?? 0), 0) / (rowData.length || 1);
        cellMap[row][col] = val;
        allVals.push(val);
      }
    }
    const maxVal = Math.max(...allVals, 1);

    const textPrimary = theme?.cardText ?? "#374151";
    const textMuted   = theme?.cardTextMuted ?? "#9ca3af";

    return (
      <div className="w-full h-full overflow-auto p-2">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1.5" />
              {numCols.map((c) => (
                <th key={c} className="p-1.5 text-center font-medium truncate max-w-[80px]" style={{ color: textMuted }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((row) => (
              <tr key={row}>
                <td className="p-1.5 font-medium whitespace-nowrap" style={{ color: textPrimary }}>{row}</td>
                {numCols.map((col) => {
                  const val = cellMap[row][col];
                  const intensity = val / maxVal;
                  const alpha = Math.round(intensity * 200 + 30).toString(16).padStart(2, "0");
                  return (
                    <td
                      key={col}
                      className="p-1.5 text-center rounded"
                      style={{
                        backgroundColor: `${color}${alpha}`,
                        color: intensity > 0.55 ? "#fff" : textPrimary,
                      }}
                    >
                      {formatNumber(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-sm"
      style={{ color: theme?.cardTextMuted ?? "#9ca3af" }}>
      Unsupported chart type: {spec.type}
    </div>
  );
}
