// ── EDA Types ────────────────────────────────────────────────────────────────

export type ColumnClassification =
  | "categorical"
  | "binary"
  | "numeric_continuous"
  | "numeric_discrete"
  | "high_cardinality_numeric"
  | "date"
  | "id_column";

export interface ColumnProfile {
  name: string;
  type: string;
  classification: ColumnClassification;
  mean: number | null;
  median: number | null;
  mode: string | number | null;
  min: number | null;
  max: number | null;
  null_count: number;
  null_pct: number;
  unique_count: number;
  transformation_applied: string;
  new_column_created: string;
  range_buckets: Record<string, string>;
  recommended_chart: string;
  has_outliers: boolean;
}

export interface BinaryDecoding {
  column: string;
  "0_label": string;
  "1_label": string;
}

export interface RangeGrouping {
  original_column: string;
  new_column: string;
  buckets: Record<string, string>;
}

export interface OutlierEntry {
  column: string;
  outlier_count: number;
  action: "flagged";
}

export interface EdaSummary {
  original_rows: number;
  duplicates_removed: number;
  clean_rows: number;
  columns_analyzed: number;
  columns_dropped: string[];
  nulls_imputed: Record<string, { method: string; value: unknown }>;
  outliers_flagged: Record<string, number>;
  type_fixes: Record<string, string>;
}

export interface EDAResult {
  eda_summary: EdaSummary;
  column_profiles: ColumnProfile[];
  binary_decodings: BinaryDecoding[];
  range_groupings: RangeGrouping[];
  outlier_report: OutlierEntry[];
  visualization_ready_columns: string[];
  excluded_columns: string[];
  eda_insights: string[];
  clean_rows: Record<string, unknown>[];
}

// ── API call ─────────────────────────────────────────────────────────────────

export async function runEda(
  rows: Record<string, unknown>[],
  schema: object[],
  description: string
): Promise<EDAResult> {
  const res = await fetch("/api/eda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, column_schema: schema, description }),
  });
  if (!res.ok) {
    throw new Error(`EDA failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// ── Download helper ───────────────────────────────────────────────────────────

export function downloadCleanedCSV(
  cleanRows: Record<string, unknown>[],
  filename: string
) {
  if (!cleanRows.length) return;
  const cols = Object.keys(cleanRows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv =
    cols.map(escape).join(",") +
    "\n" +
    cleanRows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(".csv", "") + "_cleaned.csv";
  a.click();
  URL.revokeObjectURL(url);
}
