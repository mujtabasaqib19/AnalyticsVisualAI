"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import GridLayout, { Layout, WidthProvider } from "react-grid-layout";
const ResponsiveGridLayout = WidthProvider(GridLayout);
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  BarChart3, Download, RefreshCw, Plus, ChevronRight,
  Sparkles, MessageSquare, ArrowLeft, AlertTriangle,
  Database, Palette, PanelLeftClose, PanelLeftOpen, X,
} from "lucide-react";
import Link from "next/link";
import { useDashboardStore, type DashboardSpec } from "@/store/dashboardStore";
import { GRID_COLS, GRID_ROW_HEIGHT_PX, GRID_MARGIN, DASHBOARD_SAMPLE_ROWS } from "@/lib/constants";
import { generateDashboard } from "@/lib/claude";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { QualityBadge } from "@/components/dashboard/QualityBadge";
import { ChartSettingsPanel } from "@/components/editor/ChartSettingsPanel";
import { GenerationStatusOverlay } from "@/components/dashboard/GenerationStatus";
import { ThemePanel } from "@/components/dashboard/ThemePanel";
import { ExportPanel } from "@/components/dashboard/ExportPanel";
import { FeedbackButton } from "@/components/dashboard/FeedbackButton";
import { TourHelpButton } from "@/components/dashboard/OnboardingTour";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";


export default function DashboardPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLElement>(null);
  const [canvasWidth, setCanvasWidth]           = useState(1000);
  const [settingsPanelId, setSettingsPanelId]   = useState<string | null>(null);
  const [followUpQuery, setFollowUpQuery]        = useState("");
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError]         = useState<string | null>(null);
  const [showThemePanel, setShowThemePanel]      = useState(false);
  const [showExportPanel, setShowExportPanel]    = useState(false);
  const [qualityWarning, setQualityWarning]      = useState<{ score: number; issues: string[] } | null>(null);
  const [pendingSpec, setPendingSpec]            = useState<DashboardSpec | null>(null);
  const [sidebarOpen, setSidebarOpen]            = useState(true);   // collapsible sidebar
  const [mobileMenuOpen, setMobileMenuOpen]      = useState(false);  // mobile drawer

  // ── Hydration guard ────────────────────────────────────────────────────────
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    if (useDashboardStore.persist.hasHydrated()) {
      setIsHydrated(true);
    } else {
      const unsub = useDashboardStore.persist.onFinishHydration(() => setIsHydrated(true));
      return unsub;
    }
  }, []);

  const {
    parsedData, parsedDataArray, dashboardSpec, validation, status, errorMessage,
    userQuery, dashboardType,
    setDashboardSpec, setValidation, setStatus, setErrorMessage,
    updateChartPosition, selectedChartId, setSelectedChartId, activeTheme,
  } = useDashboardStore();

  // ResizeObserver for canvas width
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setCanvasWidth(entries[0].contentRect.width);
    });
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setSidebarOpen(!mq.matches);
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Close right panels when screen gets small
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) { setShowThemePanel(false); setSettingsPanelId(null); setShowExportPanel(false); }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Main startup logic (gated on hydration)
  useEffect(() => {
    if (!isHydrated) return;
    if (!parsedData) { router.push("/upload"); return; }
    if (status === "ready") return;
    if (!dashboardSpec && status === "idle" && userQuery) runGeneration();
  }, [isHydrated]); // eslint-disable-line

  function buildFiles() {
    const source = parsedDataArray.length > 0 ? parsedDataArray : (parsedData ? [parsedData] : []);
    return source.map((f) => ({
      fileName: f.fileName,
      schema: {
        columns:              f.columns,
        row_count:            f.rowCount,
        suggested_metrics:    f.columns.filter((c) => c.type === "numeric").map((c) => c.name),
        suggested_dimensions: f.columns.filter((c) => c.type === "string").map((c) => c.name),
      },
      rows: f.rows as object[],
    }));
  }

  async function runGeneration() {
    if (!parsedData || !userQuery) return;
    setStatus("parsing");
    setErrorMessage(null);
    setValidation(null);
    const files = buildFiles();
    try {
      setStatus("generating");
      const { spec, quality, mergedData } = await generateDashboard({ files, userQuery, dashboardType });
      if (mergedData) {
        useDashboardStore.getState().setParsedData(mergedData);
      }
      if (quality) setValidation(quality);
      if (quality?.quality_score !== null && quality?.quality_score !== undefined && quality.quality_score < 50) {
        setPendingSpec(spec);
        setQualityWarning({ score: quality.quality_score, issues: quality.issues });
        setStatus("idle");
        return;
      }
      setDashboardSpec(spec);
      setStatus("ready");
      trackEvent("dashboard_generated", { query: userQuery, domain: dashboardType, charts: spec.charts.length });
    } catch (e) {
      setErrorMessage((e as Error).message);
      setStatus("error");
    }
  }

  function handleQualityProceed() {
    if (!pendingSpec) return;
    setDashboardSpec(pendingSpec);
    setStatus("ready");
    trackEvent("dashboard_generated", { query: userQuery, domain: dashboardType, charts: pendingSpec.charts.length });
    setQualityWarning(null);
    setPendingSpec(null);
  }

  function handleQualityCancel() {
    setQualityWarning(null);
    setPendingSpec(null);
    setStatus("idle");
  }

  async function handleFollowUp() {
    if (!followUpQuery.trim() || !parsedData) return;
    setIsFollowUpLoading(true);
    setFollowUpError(null);
    try {
      const { spec: newSpec, mergedData } = await generateDashboard({
        files: buildFiles(), userQuery: followUpQuery, dashboardType,
      });
      if (mergedData) {
        useDashboardStore.getState().setParsedData(mergedData);
      }
      if (dashboardSpec) {
        const merged = [...dashboardSpec.charts];
        for (const chart of newSpec.charts) {
          const idx = merged.findIndex((c) => c.id === chart.id);
          if (idx >= 0) merged[idx] = chart; else merged.push(chart);
        }
        setDashboardSpec({ ...dashboardSpec, charts: merged });
      } else {
        setDashboardSpec(newSpec);
      }
      setFollowUpQuery("");
      setMobileMenuOpen(false);
    } catch (e) {
      setFollowUpError((e as Error).message || "Failed to add chart. Please try again.");
    } finally {
      setIsFollowUpLoading(false);
    }
  }

  // ── Layout normalization: scale charts per row to fill all 12 columns ───
  function normalizeChartPositions(charts: any[]) {
    if (!charts?.length) return charts ?? [];
    // Group by y (same y = same grid row)
    const rows = new Map<number, any[]>();
    for (const c of charts) {
      if (!c.position) continue;
      if (!rows.has(c.position.y)) rows.set(c.position.y, []);
      rows.get(c.position.y)!.push({ ...c, position: { ...c.position } });
    }
    const result: any[] = [];
    for (const rowCharts of Array.from(rows.values())) {
      rowCharts.sort((a: any, b: any) => a.position.x - b.position.x);
      const totalW = rowCharts.reduce((s: number, c: any) => s + c.position.w, 0);
      if (totalW > 0 && totalW < 12) {
        // Scale up proportionally so the row fills 12 columns
        let x = 0;
        rowCharts.forEach((c: any, i: number) => {
          const isLast = i === rowCharts.length - 1;
          const newW = isLast ? 12 - x : Math.round((c.position.w / totalW) * 12);
          result.push({ ...c, position: { ...c.position, x, w: Math.max(2, newW) } });
          x += Math.max(2, newW);
        });
      } else {
        result.push(...rowCharts);
      }
    }
    return result;
  }

  // ── Layout state: positions only, synced once per new dashboard ──────────────
  // Tracks x/y/w/h per chart ID so drag/resize don't fight settings changes.
  const [layoutPositions, setLayoutPositions] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});

  useEffect(() => {
    // Re-initialize positions only when a new dashboard is generated (title or chart count changes).
    // Never re-run on field/color changes — that would reset drag positions.
    if (!dashboardSpec?.charts?.length) {
      setLayoutPositions({});
      return;
    }
    const normalized = normalizeChartPositions(dashboardSpec.charts);
    const positions: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const c of normalized) positions[c.id] = c.position;
    setLayoutPositions(positions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardSpec?.dashboard_title, dashboardSpec?.charts?.length]);

  // mergedCharts = latest spec fields from store + latest positions from layoutPositions.
  // Settings panel changes update the store → reflected here immediately.
  // Drag/resize updates layoutPositions → reflected here without overwriting fields.
  const mergedCharts = useMemo(() => {
    if (!dashboardSpec?.charts) return [];
    return dashboardSpec.charts.map((spec) => {
      const pos = layoutPositions[spec.id] ?? spec.position;
      return { ...spec, position: pos };
    });
  }, [dashboardSpec?.charts, layoutPositions]);

  const layout: Layout[] = mergedCharts.map((c) => ({
    i: c.id, x: c.position.x, y: c.position.y, w: c.position.w, h: c.position.h, minW: 2, minH: 2,
  }));

  const handleLayoutChange = (newLayout: Layout[]) => {
    const updated: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const item of newLayout) {
      updated[item.i] = { x: item.x, y: item.y, w: item.w, h: item.h };
      updateChartPosition(item.i, { x: item.x, y: item.y, w: item.w, h: item.h });
    }
    setLayoutPositions((prev) => ({ ...prev, ...updated }));
  };
  const rowHeight = GRID_ROW_HEIGHT_PX;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (!isHydrated) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden animate-pulse">
        <div className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 shrink-0">
          <div className="w-6 h-6 rounded-md bg-gray-200" />
          <div className="w-32 sm:w-48 h-4 rounded-full bg-gray-200" />
          <div className="ml-auto flex gap-2">
            <div className="w-16 sm:w-20 h-7 rounded-lg bg-gray-200" />
            <div className="w-20 sm:w-24 h-7 rounded-lg bg-gray-200" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden md:block w-60 bg-white border-r border-gray-100 shrink-0" />
          <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 sm:h-48 bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Sidebar content (shared between desktop sidebar and mobile drawer)
  const SidebarContent = () => (
    <>
      {/* Follow-up input */}
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ask Follow-up</p>
        <div className="relative">
          <textarea
            value={followUpQuery}
            onChange={(e) => setFollowUpQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFollowUp(); } }}
            placeholder="Add another chart..."
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 resize-none"
          />
          <button
            onClick={handleFollowUp}
            disabled={!followUpQuery.trim() || isFollowUpLoading}
            className="mt-1.5 w-full py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isFollowUpLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add Chart
          </button>
          {followUpError && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {followUpError}
            </p>
          )}
        </div>
      </div>

      {/* Suggestions — powered by Claude's suggested_insights */}
      {dashboardSpec?.suggested_insights && dashboardSpec.suggested_insights.length > 0 && (
        <div className="p-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" /> Claude Suggestions
          </p>
          <div className="space-y-0.5">
            {dashboardSpec.suggested_insights.map((insight, i) => (
              <button
                key={i}
                onClick={() => { setFollowUpQuery(insight); setMobileMenuOpen(false); }}
                className="w-full text-left text-xs p-2 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-700 transition-all flex items-start gap-1.5 group"
              >
                <ChevronRight className="w-3 h-3 mt-0.5 text-amber-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                {insight}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dataset info */}
      {parsedData && (
        <div className="p-3 mt-auto border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database className="w-3 h-3" /> Dataset
          </p>
          <p className="text-xs text-gray-600 font-medium truncate">{parsedData.fileName}</p>
          <p className="text-xs text-gray-400">{parsedData.rowCount.toLocaleString()} rows · {parsedData.columns.length} columns</p>
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <GenerationStatusOverlay status={status} errorMessage={errorMessage} />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-3 sm:px-4 shrink-0 z-20 shadow-sm gap-2">
        {/* Left: back + sidebar toggle + title */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Link
            href="/upload"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Desktop sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-gray-900 truncate max-w-[120px] sm:max-w-[220px] md:max-w-xs">
              {dashboardSpec?.dashboard_title ?? "Dashboard"}
            </span>
          </div>

          {parsedData && (
            <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-md hidden lg:block whitespace-nowrap shrink-0">
              {parsedData.fileName} · {parsedData.rowCount.toLocaleString()} rows
            </span>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {validation && <div className="hidden sm:block"><QualityBadge validation={validation} /></div>}

          {/* Theme button */}
          <button
            onClick={() => { setShowThemePanel(!showThemePanel); setSettingsPanelId(null); setShowExportPanel(false); }}
            className={cn(
              "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs border rounded-lg transition-all",
              showThemePanel
                ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                : "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50 text-gray-600 hover:text-violet-700"
            )}
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Theme</span>
            {activeTheme && (
              <span className="w-2 h-2 rounded-full border border-white shadow-sm" style={{ backgroundColor: activeTheme.chartColors[0] }} />
            )}
          </button>

          {/* Regenerate */}
          <button
            onClick={runGeneration}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Regenerate</span>
          </button>

          {/* Export panel toggle */}
          <button
            onClick={() => { setShowExportPanel(!showExportPanel); setShowThemePanel(false); setSettingsPanelId(null); }}
            className={cn(
              "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs rounded-lg transition-all shadow-sm",
              showExportPanel
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </header>

      {/* ── Mobile sidebar drawer ──────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-30 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="fixed top-14 left-0 bottom-0 w-72 bg-white border-r border-gray-100 z-40 overflow-y-auto md:hidden flex flex-col"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* ── Desktop Sidebar ──────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden md:flex flex-col bg-white border-r border-gray-100 shrink-0 overflow-y-auto overflow-x-hidden"
              style={{ minWidth: 0 }}
            >
              <div className="w-60">
                <SidebarContent />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Canvas ──────────────────────────────────────────────────────── */}
        <main
          ref={canvasRef}
          className="flex-1 overflow-auto min-w-0"
          style={{ background: activeTheme?.canvasBg ?? "#f9fafb" }}
          onClick={() => setSelectedChartId(null)}
        >
          <div id="dashboard-canvas" className="min-h-full p-2">
            {status === "ready" && mergedCharts.length ? (
              <ResponsiveGridLayout
              className="layout"
              layout={layout}
              cols={GRID_COLS}
              rowHeight={rowHeight}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".cursor-grab"
              margin={GRID_MARGIN}
              compactType={null}
              preventCollision={false}
              resizeHandles={["se", "sw", "ne", "nw"]}
            >
              {mergedCharts.map((chart) => (
                <div key={chart.id} onClick={(e) => e.stopPropagation()}>
                    <ChartCard
                      spec={chart}
                      data={parsedData?.rows as Record<string, unknown>[] ?? []}
                      onSettingsOpen={(id) => { setSettingsPanelId(id); setShowThemePanel(false); }}
                    />
                  </div>
              ))}
            </ResponsiveGridLayout>
            ) : status === "ready" && !mergedCharts.length ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 px-4">
                <MessageSquare className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-gray-400">No charts generated. Try a follow-up query.</p>
              </div>
            ) : status === "error" ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 px-4">
                <AlertTriangle className="w-12 h-12 text-red-300 mb-4" />
                <p className="text-red-500 mb-2 font-medium">Generation failed</p>
                <p className="text-gray-400 text-sm mb-5 max-w-xs">{errorMessage}</p>
                <button
                  onClick={runGeneration}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Try Again
                </button>
              </div>
            ) : null}
          </div>
        </main>

        {/* ── Right panels (Chart settings + Theme) ───────────────────────── */}
        <AnimatePresence>
          {settingsPanelId && (
            <motion.div
              key="settings"
              initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 hidden sm:block overflow-hidden"
            >
              <ChartSettingsPanel chartId={settingsPanelId} onClose={() => setSettingsPanelId(null)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showThemePanel && (
            <motion.div
              key="theme"
              initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="shrink-0 hidden sm:block overflow-hidden"
            >
              <ThemePanel onClose={() => setShowThemePanel(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showExportPanel && (
            <motion.div
              key="export"
              initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 hidden sm:block overflow-hidden"
            >
              <ExportPanel onClose={() => setShowExportPanel(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile: Chart settings / Theme / Export as bottom sheet ─────────── */}
      <AnimatePresence>
        {(settingsPanelId || showThemePanel || showExportPanel) && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-30 sm:hidden"
              onClick={() => { setSettingsPanelId(null); setShowThemePanel(false); setShowExportPanel(false); }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white rounded-t-2xl shadow-2xl overflow-y-auto"
              style={{ maxHeight: "75vh" }}
            >
              {settingsPanelId && (
                <ChartSettingsPanel chartId={settingsPanelId} onClose={() => setSettingsPanelId(null)} />
              )}
              {showThemePanel && (
                <ThemePanel onClose={() => setShowThemePanel(false)} />
              )}
              {showExportPanel && (
                <ExportPanel onClose={() => setShowExportPanel(false)} />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Fixed overlays ──────────────────────────────────────────────────── */}
      <FeedbackButton />
      <div className="fixed bottom-5 left-5 z-50">
        <TourHelpButton />
      </div>

      {/* ── Quality warning modal ────────────────────────────────────────────── */}
      {qualityWarning && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Poor Data Quality Detected</p>
                <p className="text-sm text-gray-500">Gemini score: {qualityWarning.score}/100</p>
              </div>
            </div>
            {qualityWarning.issues.length > 0 && (
              <ul className="mb-4 space-y-1.5 max-h-40 overflow-y-auto">
                {qualityWarning.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2 bg-red-50 rounded-lg p-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-400 mb-5">
              Low quality data may produce inaccurate charts. Proceed anyway or cancel to fix the data first.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleQualityCancel}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleQualityProceed}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
