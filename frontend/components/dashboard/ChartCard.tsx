"use client";

import { useState, useRef, useEffect } from "react";
import { X, Settings, GripVertical } from "lucide-react";
import type { ChartSpec } from "@/store/dashboardStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

interface ChartCardProps {
  spec: ChartSpec;
  data: Record<string, unknown>[];
  onSettingsOpen: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  bar: "Bar", line: "Line", area: "Area", pie: "Pie", donut: "Donut",
  scatter: "Scatter", kpi_card: "KPI", table: "Table", funnel: "Funnel", gauge: "Gauge",
};

export function ChartCard({ spec, data, onSettingsOpen }: ChartCardProps) {
  const { selectedChartId, setSelectedChartId, removeChart, activeTheme } = useDashboardStore();
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedChartId === spec.id;

  // ── Lazy loading via IntersectionObserver ───────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect(); // render once, never unload
          trackEvent("chart_view", { chartType: spec.type, chartId: spec.id });
        }
      },
      { rootMargin: "120px" } // pre-load 120px before visible
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [spec.id, spec.type]);

  // Apply theme overrides if active
  const cardStyle = activeTheme
    ? {
        background: activeTheme.cardBg,
        borderColor: isSelected ? "#8b5cf6" : activeTheme.cardBorder,
      }
    : {};

  const headerStyle = activeTheme
    ? {
        background: activeTheme.cardHeaderBg,
        borderBottomColor: activeTheme.cardBorder,
        color: activeTheme.cardText,
      }
    : {};

  const badgeStyle = activeTheme
    ? {
        background: `${activeTheme.cardBorder}40`,
        color: activeTheme.cardTextMuted,
      }
    : {};

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full flex flex-col rounded-2xl border overflow-hidden transition-all shadow-sm",
        !activeTheme && (
          isSelected
            ? "bg-white border-blue-400 ring-2 ring-blue-100 shadow-md"
            : hovered
            ? "bg-white border-blue-200 shadow-md"
            : "bg-white border-gray-100"
        )
      )}
      style={activeTheme ? { ...cardStyle, boxShadow: isSelected ? "0 0 0 2px #8b5cf6" : undefined } : {}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setSelectedChartId(isSelected ? null : spec.id)}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2.5 border-b shrink-0",
          !activeTheme && "bg-gray-50/60 border-gray-100"
        )}
        style={activeTheme ? headerStyle : {}}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical
            className="w-3.5 h-3.5 shrink-0 cursor-grab"
            style={activeTheme ? { color: activeTheme.cardTextMuted } : { color: "#d1d5db" }}
          />
          <span
            className="text-sm font-medium truncate"
            style={activeTheme ? { color: activeTheme.cardText } : {}}
          >
            {spec.title}
          </span>
          <span
            className={cn("text-xs px-1.5 py-0.5 rounded-md shrink-0", !activeTheme && "bg-gray-100 text-gray-500 border border-gray-200")}
            style={activeTheme ? badgeStyle : {}}
          >
            {TYPE_LABELS[spec.type] ?? spec.type}
          </span>
        </div>
        <div className={cn("flex items-center gap-1 transition-opacity", hovered || isSelected ? "opacity-100" : "opacity-0")}>
          <button
            onClick={(e) => { e.stopPropagation(); onSettingsOpen(spec.id); }}
            className="p-1 rounded-md hover:bg-black/10 transition-colors"
            style={activeTheme ? { color: activeTheme.cardTextMuted } : { color: "#9ca3af" }}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeChart(spec.id); }}
            className="p-1 rounded-md hover:bg-red-50 transition-colors"
            style={activeTheme ? { color: activeTheme.cardTextMuted } : { color: "#9ca3af" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chart — only rendered when in viewport */}
      <div
        className="flex-1 min-h-0 p-3"
        style={activeTheme ? { background: activeTheme.cardBg } : {}}
      >
        {inView ? (
          <ChartRenderer spec={spec} data={data} isSelected={isSelected} theme={activeTheme} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-gray-100 border-t-blue-300 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

