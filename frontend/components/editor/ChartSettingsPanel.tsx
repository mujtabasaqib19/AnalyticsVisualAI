"use client";

import { X, Palette, SlidersHorizontal } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import type { ChartType } from "@/store/dashboardStore";
import { CHART_COLORS } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ChartSettingsPanelProps {
  chartId: string;
  onClose: () => void;
}

const CHART_TYPES: { value: ChartType; label: string; icon: string }[] = [
  { value: "bar", label: "Bar", icon: "▬" },
  { value: "line", label: "Line", icon: "📈" },
  { value: "area", label: "Area", icon: "◭" },
  { value: "pie", label: "Pie", icon: "◔" },
  { value: "donut", label: "Donut", icon: "○" },
  { value: "scatter", label: "Scatter", icon: "⋯" },
  { value: "kpi_card", label: "KPI Card", icon: "#" },
  { value: "table", label: "Table", icon: "▦" },
  { value: "funnel", label: "Funnel", icon: "▽" },
];

const AGGREGATIONS = ["sum", "avg", "count", "max", "min"] as const;
const TOP_N_PRESETS = [5, 10, 15, 20] as const;
const TOP_N_SUPPORTED: ChartType[] = ["bar", "pie", "donut"];

function fmt(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateTitle(
  type: ChartType,
  xField: string | undefined,
  yField: string | undefined,
  aggregation: string | undefined
): string {
  const x = xField ? fmt(xField) : "";
  const y = yField ? fmt(yField) : "";
  const agg = aggregation
    ? aggregation.charAt(0).toUpperCase() + aggregation.slice(1)
    : "";

  if (type === "kpi_card") {
    if (y && agg && agg !== "Count") return `${agg} ${y}`;
    if (y) return y;
    return "KPI";
  }
  if (type === "scatter") return x && y ? `${y} vs ${x}` : y || x || "Scatter";
  if (type === "pie" || type === "donut") return x ? `${x} Distribution` : "Distribution";
  if (type === "funnel") return x ? `${x} Funnel` : "Funnel";
  if (type === "table") return x && y ? `${x} & ${y}` : x || y || "Data Table";
  // bar | line | area
  if (x && y) return `${y} by ${x}`;
  return y || (x ? `By ${x}` : "Chart");
}

export function ChartSettingsPanel({ chartId, onClose }: ChartSettingsPanelProps) {
  const { dashboardSpec, updateChart, parsedData } = useDashboardStore();
  const chart = dashboardSpec?.charts.find((c) => c.id === chartId);
  if (!chart) return null;

  const columns = parsedData?.columns ?? [];

  return (
    <div className="w-72 h-full bg-white border-l border-gray-100 flex flex-col overflow-y-auto shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <span className="font-semibold text-sm text-gray-800">Chart Settings</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Title</label>
          <input
            value={chart.title}
            onChange={(e) => updateChart(chartId, { title: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all"
          />
        </div>

        {/* Chart Type */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Chart Type</label>
          <div className="grid grid-cols-3 gap-1.5">
            {CHART_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => updateChart(chartId, {
                  type: t.value,
                  title: generateTitle(t.value, chart.x_field, chart.y_field ?? chart.value_field, chart.aggregation),
                })}
                className={cn(
                  "p-2 rounded-xl border text-xs flex flex-col items-center gap-1 transition-all",
                  chart.type === t.value
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white hover:border-blue-200 text-gray-500 hover:text-gray-800"
                )}
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* X Field */}
        {chart.type !== "kpi_card" && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              X Axis / Dimension
            </label>
            <select
              value={chart.x_field ?? ""}
              onChange={(e) => {
                const x = e.target.value;
                updateChart(chartId, {
                  x_field: x,
                  title: generateTitle(chart.type, x, chart.y_field, chart.aggregation),
                });
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
            >
              <option value="">— Select field —</option>
              {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        )}

        {/* Y Field */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            {chart.type === "kpi_card" ? "Value Field" : "Y Axis / Metric"}
          </label>
          <select
            value={chart.y_field ?? chart.value_field ?? ""}
            onChange={(e) => {
              const y = e.target.value;
              const fieldUpdate = chart.type === "kpi_card" ? { value_field: y } : { y_field: y };
              updateChart(chartId, {
                ...fieldUpdate,
                title: generateTitle(chart.type, chart.x_field, y, chart.aggregation),
              });
            }}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          >
            <option value="">— Select field —</option>
            {columns.filter((c) => c.type === "numeric").map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Aggregation */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Aggregation
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {AGGREGATIONS.map((agg) => (
              <button
                key={agg}
                onClick={() => updateChart(chartId, {
                  aggregation: agg,
                  title: generateTitle(chart.type, chart.x_field, chart.y_field ?? chart.value_field, agg),
                })}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-xs transition-all capitalize",
                  chart.aggregation === agg
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white hover:border-blue-200 text-gray-500"
                )}
              >
                {agg}
              </button>
            ))}
          </div>
        </div>

        {/* Top N — only for bar, pie, donut */}
        {TOP_N_SUPPORTED.includes(chart.type) && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Top N
            </label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {TOP_N_PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => updateChart(chartId, { top_n: n })}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border text-xs transition-all font-medium",
                    chart.top_n === n
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white hover:border-blue-200 text-gray-500"
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => updateChart(chartId, { top_n: undefined })}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-xs transition-all font-medium",
                  chart.top_n === undefined
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white hover:border-blue-200 text-gray-500"
                )}
              >
                All
              </button>
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={chart.top_n ?? ""}
              placeholder={"Default (20)"}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                updateChart(chartId, { top_n: isNaN(v) || v < 1 ? undefined : v });
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {chart.type === "bar"
                ? "Shows the top N categories sorted by value"
                : "Shows the top N slices (remaining grouped as Other)"}
            </p>
          </div>
        )}

        {/* Color palette */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
            <Palette className="w-3.5 h-3.5" /> Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {CHART_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateChart(chartId, { color: c })}
                className={cn(
                  "w-7 h-7 rounded-lg border-2 transition-all shadow-sm",
                  chart.color === c ? "border-gray-700 scale-110 shadow-md" : "border-transparent hover:scale-105 hover:border-gray-300"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
