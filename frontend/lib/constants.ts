// Central constants — all magic values live here.
// Keep quality thresholds in sync with backend/config.py.

// ── API ───────────────────────────────────────────────────────────────────────
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Quality thresholds (mirrors backend/config.py) ────────────────────────────
export const QUALITY_GOOD     = 80;
export const QUALITY_MODERATE = 50;

// ── Data limits ───────────────────────────────────────────────────────────────
export const DASHBOARD_SAMPLE_ROWS = 10;   // rows sent to Claude / Gemini
export const SHARE_ROWS_LIMIT      = 200;  // rows encoded in share link

// ── Chart render limits ───────────────────────────────────────────────────────
export const TABLE_ROW_LIMIT     = 50;
export const BAR_CATEGORY_LIMIT  = 20;   // max categories shown in bar/line/area (sorted by value desc)
export const PIE_SLICE_LIMIT     = 8;
export const SCATTER_POINT_LIMIT = 200;
export const FUNNEL_STAGE_LIMIT  = 6;
export const HEATMAP_ROW_LIMIT   = 12;
export const HEATMAP_COL_LIMIT   = 6;

// ── Dashboard grid ────────────────────────────────────────────────────────────
export const GRID_COLS          = 12;
export const GRID_ROW_HEIGHT_PX = 56;
export const GRID_MARGIN: [number, number] = [8, 8];

// ── Generation ────────────────────────────────────────────────────────────────
export const MAX_QUERY_LENGTH  = 5000;
export const MAX_CLAUDE_TOKENS = 8000;   // raised — wide schemas need more output budget
