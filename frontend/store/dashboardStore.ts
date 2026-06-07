import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ParsedData } from "@/lib/parser";
import type { GeminiValidationResult } from "@/lib/gemini";
import type { DashboardTheme } from "@/app/api/theme/route";

export type { DashboardTheme };

export type ChartType =
  | "bar" | "line" | "area" | "pie" | "donut"
  | "scatter" | "kpi_card" | "table" | "funnel" | "gauge" | "heatmap";

export interface ChartSpec {
  id: string;
  type: ChartType;
  title: string;
  x_field?: string;
  y_field?: string;
  value_field?: string;
  aggregation?: "sum" | "avg" | "count" | "max" | "min";
  color?: string;
  position: { x: number; y: number; w: number; h: number };
  filters?: Record<string, unknown>;
  /** Max number of categories to display on bar/line/area charts (default: BAR_CATEGORY_LIMIT=20) */
  top_n?: number;
}

export interface DashboardSpec {
  dashboard_title: string;
  theme: string;
  layout: string;
  charts: ChartSpec[];
  suggested_insights?: string[];
}

export type GenerationStatus = "idle" | "parsing" | "validating" | "generating" | "ready" | "error";

// Rows are NEVER persisted to localStorage — they are too large and are
// re-parsed from the file on page reload. Only schema + metadata is kept.
function slimParsedData(pd: ParsedData | null): ParsedData | null {
  if (!pd) return null;
  // Persist schema/metadata but zero rows
  return { ...pd, rows: [] };
}

// Safe localStorage wrapper — silently no-ops on QuotaExceededError instead
// of crashing the whole app.
const safeLocalStorage = {
  getItem: (name: string) => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        // Quota hit — persist minimal fallback (spec + query only, no row data)
        try {
          const parsed = JSON.parse(value);
          const minimal = JSON.stringify({
            state: {
              dashboardSpec: parsed?.state?.dashboardSpec ?? null,
              userQuery:     parsed?.state?.userQuery     ?? "",
              dashboardType: parsed?.state?.dashboardType ?? "auto",
              status:        parsed?.state?.status        ?? "idle",
              activeTheme:   parsed?.state?.activeTheme   ?? null,
              validation:    parsed?.state?.validation    ?? null,
              selectedFileIndex: parsed?.state?.selectedFileIndex ?? -1,
              // Store schema only — no rows
              parsedData: parsed?.state?.parsedData
                ? { ...parsed.state.parsedData, rows: [] }
                : null,
              parsedDataArray: (parsed?.state?.parsedDataArray ?? []).map(
                (f: ParsedData) => ({ ...f, rows: [] })
              ),
            },
            version: parsed?.version,
          });
          localStorage.setItem(name, minimal);
        } catch {
          // If even the minimal write fails, clear the key so the app stays functional
          try { localStorage.removeItem(name); } catch { /* ignore */ }
        }
      }
    }
  },
  removeItem: (name: string) => {
    try { localStorage.removeItem(name); } catch { /* ignore */ }
  },
};

interface DashboardState {
  parsedDataArray: ParsedData[];
  selectedFileIndex: number;
  parsedData: ParsedData | null;
  addParsedData: (data: ParsedData) => void;
  removeFileByIndex: (index: number) => void;
  setSelectedFileIndex: (index: number) => void;
  clearAllFiles: () => void;
  /** Replace the currently selected file's data (used after EDA to swap in cleaned rows) */
  replaceCurrentParsedData: (data: ParsedData) => void;
  /** Backward-compat alias used by upload page */
  setParsedData: (data: ParsedData | null) => void;

  dashboardSpec: DashboardSpec | null;
  setDashboardSpec: (spec: DashboardSpec | null) => void;

  validation: GeminiValidationResult | null;
  setValidation: (v: GeminiValidationResult | null) => void;

  status: GenerationStatus;
  setStatus: (s: GenerationStatus) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;

  userQuery: string;
  setUserQuery: (q: string) => void;
  dashboardType: string;
  setDashboardType: (t: string) => void;

  selectedChartId: string | null;
  setSelectedChartId: (id: string | null) => void;
  updateChart: (id: string, updates: Partial<ChartSpec>) => void;
  removeChart: (id: string) => void;

  updateChartPosition: (id: string, position: ChartSpec["position"]) => void;

  // Active colour theme (Claude-generated, Gemini-audited)
  activeTheme: DashboardTheme | null;
  setActiveTheme: (t: DashboardTheme | null) => void;

  reset: () => void;
}

const computeParsedData = (state: {
  parsedDataArray: ParsedData[];
  selectedFileIndex: number;
}): ParsedData | null =>
  state.selectedFileIndex >= 0 && state.selectedFileIndex < state.parsedDataArray.length
    ? state.parsedDataArray[state.selectedFileIndex]
    : null;

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      parsedDataArray: [],
      selectedFileIndex: -1,
      parsedData: null,

      addParsedData: (data) =>
        set((state) => {
          const newArray = [...state.parsedDataArray, data];
          return {
            parsedDataArray: newArray,
            selectedFileIndex: newArray.length - 1,
            parsedData: data,
          };
        }),

      removeFileByIndex: (index) =>
        set((state) => {
          const newArray = state.parsedDataArray.filter((_, i) => i !== index);
          let newIndex = state.selectedFileIndex;
          if (newIndex === index) {
            newIndex = newArray.length > 0 ? Math.min(index, newArray.length - 1) : -1;
          } else if (newIndex > index) {
            newIndex--;
          }
          const newParsedData = computeParsedData({
            parsedDataArray: newArray,
            selectedFileIndex: newIndex,
          });
          return { parsedDataArray: newArray, selectedFileIndex: newIndex, parsedData: newParsedData };
        }),

      setSelectedFileIndex: (index) =>
        set((state) => {
          const newParsedData = computeParsedData({
            parsedDataArray: state.parsedDataArray,
            selectedFileIndex: index,
          });
          return { selectedFileIndex: index, parsedData: newParsedData };
        }),

      clearAllFiles: () =>
        set({ parsedDataArray: [], selectedFileIndex: -1, parsedData: null }),

      replaceCurrentParsedData: (data) =>
        set((state) => {
          const idx = state.selectedFileIndex;
          if (idx < 0 || idx >= state.parsedDataArray.length) return {};
          const newArray = [...state.parsedDataArray];
          newArray[idx] = data;
          return { parsedDataArray: newArray, parsedData: data };
        }),

      // Alias used by the upload page for single-file mode
      setParsedData: (data) => {
        if (!data) {
          get().clearAllFiles();
          return;
        }
        // Check if file already in array (by name + rowCount)
        const existing = get().parsedDataArray.findIndex(
          (p) => p.fileName === data.fileName && p.rowCount === data.rowCount
        );
        if (existing >= 0) {
          get().setSelectedFileIndex(existing);
        } else {
          get().addParsedData(data);
        }
      },

      dashboardSpec: null,
      setDashboardSpec: (spec) => set({ dashboardSpec: spec }),

      validation: null,
      setValidation: (v) => set({ validation: v }),

      status: "idle",
      setStatus: (s) => set({ status: s }),
      errorMessage: null,
      setErrorMessage: (msg) => set({ errorMessage: msg }),

      userQuery: "",
      setUserQuery: (q) => set({ userQuery: q }),
      dashboardType: "auto",
      setDashboardType: (t) => set({ dashboardType: t }),

      activeTheme: null,
      setActiveTheme: (t) => set({ activeTheme: t }),

      selectedChartId: null,
      setSelectedChartId: (id) => set({ selectedChartId: id }),

      updateChart: (id, updates) =>
        set((state) => {
          if (!state.dashboardSpec) return {};
          return {
            dashboardSpec: {
              ...state.dashboardSpec,
              charts: state.dashboardSpec.charts.map((c) =>
                c.id === id ? { ...c, ...updates } : c
              ),
            },
          };
        }),

      removeChart: (id) =>
        set((state) => {
          if (!state.dashboardSpec) return {};
          return {
            dashboardSpec: {
              ...state.dashboardSpec,
              charts: state.dashboardSpec.charts.filter((c) => c.id !== id),
            },
          };
        }),

      updateChartPosition: (id, position) =>
        set((state) => {
          if (!state.dashboardSpec) return {};
          return {
            dashboardSpec: {
              ...state.dashboardSpec,
              charts: state.dashboardSpec.charts.map((c) =>
                c.id === id ? { ...c, position } : c
              ),
            },
          };
        }),

      reset: () =>
        set({
          parsedDataArray: [],
          selectedFileIndex: -1,
          parsedData: null,
          dashboardSpec: null,
          validation: null,
          status: "idle",
          errorMessage: null,
          userQuery: "",
          dashboardType: "auto",
          selectedChartId: null,
          activeTheme: null,
        }),
    }),
    {
      name: "analyticsvisualai-v3",      // bumped — clears stale caches with row data
      storage: createJSONStorage(() => safeLocalStorage),

      // ── What we persist ───────────────────────────────────────────────────
      // Rows are NEVER written to localStorage (they are too large).
      // Only schema metadata, the dashboard spec, and UI state are persisted.
      // On reload the user re-uploads the file; rows live in memory only.
      partialize: (s) => ({
        dashboardSpec:    s.dashboardSpec,
        validation:       s.validation,
        userQuery:        s.userQuery,
        dashboardType:    s.dashboardType,
        selectedFileIndex: s.selectedFileIndex,
        activeTheme:      s.activeTheme,
        // Schema + metadata only — no rows
        parsedData: slimParsedData(s.parsedData),
        parsedDataArray: s.parsedDataArray.map(slimParsedData).filter(Boolean) as ParsedData[],
        // Always restore as "ready" if a spec exists
        status: s.dashboardSpec ? "ready" : "idle",
      }),

      version: 3,
    }
  )
);
