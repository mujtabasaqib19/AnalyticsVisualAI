"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  BarChart3, ArrowRight, Sparkles, FlaskConical, Download,
  ArrowLeft, CheckCircle2, RefreshCw, ChevronRight,
  Database, AlertTriangle, Binary, Layers, Info, XCircle, Wand2,
  ChevronDown, ChevronUp, FileText, Zap,
} from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { useEdaStore } from "@/store/edaStore";
import { runEda, downloadCleanedCSV } from "@/lib/eda";
import type { EDAResult } from "@/lib/eda";
import { inferColumns } from "@/lib/parser";
import { ColumnProfileCard } from "@/components/eda/ColumnProfileCard";
import { OutlierReport } from "@/components/eda/OutlierReport";
import { EDAInsightsList } from "@/components/eda/EDAInsightsList";
import { cn } from "@/lib/utils";

// ── Domain chips (reused from upload page) ─────────────────────────────────
const DOMAINS = [
  { value: "auto",            label: "Auto-detect",       icon: "🧠" },
  { value: "sales",           label: "Sales",             icon: "📈" },
  { value: "marketing",       label: "Marketing",         icon: "📣" },
  { value: "finance",         label: "Finance",           icon: "💰" },
  { value: "hr",              label: "HR / People",       icon: "👥" },
  { value: "healthcare",      label: "Healthcare",        icon: "🏥" },
  { value: "education",       label: "Education",         icon: "🎓" },
  { value: "e-commerce",      label: "E-Commerce",        icon: "🛒" },
  { value: "supply-chain",    label: "Supply Chain",      icon: "🚚" },
  { value: "operations",      label: "Operations",        icon: "⚙️" },
  { value: "product",         label: "Product",           icon: "🧩" },
  { value: "devops",          label: "DevOps / SRE",      icon: "🖥️" },
  { value: "climate",         label: "Climate",           icon: "🌤️" },
  { value: "economics",       label: "Economics",         icon: "📉" },
  { value: "transportation",  label: "Transportation",    icon: "🚆" },
  { value: "social-media",    label: "Social Media",      icon: "📱" },
];

type Stage = "input" | "running" | "report";

export default function EdaPage() {
  const router = useRouter();
  const {
    parsedData, parsedDataArray, selectedFileIndex,
    setSelectedFileIndex, setUserQuery, setDashboardType,
    setStatus, setErrorMessage, replaceCurrentParsedData, setDashboardSpec,
  } = useDashboardStore();
  const { edaResult, edaDescription, setEdaResult, setEdaDescription } = useEdaStore();

  const [stage, setStage]           = useState<Stage>(edaResult ? "report" : "input");
  const [description, setDescription] = useState(edaDescription || "");
  const [error, setError]           = useState<string | null>(null);
  const [cleanRows, setCleanRows]   = useState<Record<string, unknown>[]>(edaResult?.clean_rows ?? []);

  // Visualize form (shown after EDA)
  const [vizQuery,      setVizQuery]      = useState("");
  const [vizDomain,     setVizDomain]     = useState("auto");
  const [showMoreDomains, setShowMoreDomains] = useState(false);

  useEffect(() => {
    if (!parsedData) router.replace("/upload");
  }, [parsedData, router]);

  // ── Run EDA ───────────────────────────────────────────────────────────────
  async function startEda() {
    if (!parsedData) return;
    setStage("running");
    setError(null);
    setEdaDescription(description);
    try {
      const result: EDAResult = await runEda(
        parsedData.rows as Record<string, unknown>[],
        parsedData.columns as object[],
        description
      );
      setEdaResult(result);
      const rows = result.clean_rows ?? [];
      setCleanRows(rows);

      // Swap parsedData for the cleaned version immediately so it persists
      // to localStorage — this is the source of truth for the dashboard, not
      // edaResult.clean_rows (which is stripped from sessionStorage).
      if (rows.length) {
        replaceCurrentParsedData({
          rows,
          columns: inferColumns(rows),
          rowCount: rows.length,
          fileName: parsedData.fileName,
        });
      }
      // Wipe any stale dashboard spec so the dashboard regenerates with the
      // new cleaned schema instead of replaying the old one.
      setDashboardSpec(null);

      setStage("report");
    } catch (e) {
      setError((e as Error).message);
      setStage("input");
    }
  }

  // ── Proceed to dashboard ──────────────────────────────────────────────────
  // parsedData is already the cleaned version (set inside startEda above).
  // We only need to wire the query/domain and force regeneration.
  function proceedToDashboard() {
    setDashboardSpec(null);
    setUserQuery(vizQuery.trim() || "Give me a full overview dashboard using the cleaned data");
    setDashboardType(vizDomain);
    setStatus("idle");
    setErrorMessage(null);
    router.push("/dashboard");
  }

  // ── Skip EDA → go straight to dashboard ──────────────────────────────────
  function handleVisualizeDirectly() {
    setUserQuery("Give me a full overview dashboard of this dataset");
    setDashboardType("auto");
    setStatus("idle");
    setErrorMessage(null);
    router.push("/dashboard");
  }

  if (!parsedData) return null;

  const visibleDomains = showMoreDomains ? DOMAINS : DOMAINS.slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/upload" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-gray-900 hidden sm:block">
              Analytics<span className="text-blue-600">Visual</span>AI
            </span>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="text-gray-400">Upload</span>
            <ChevronRight className="w-3 h-3" />
            <span className={cn("px-2 py-0.5 rounded-md font-medium",
              stage !== "report" ? "text-indigo-600 bg-indigo-50" : "text-gray-400"
            )}>EDA</span>
            <ChevronRight className="w-3 h-3" />
            <span className={cn("px-2 py-0.5 rounded-md",
              stage === "report" ? "text-blue-600 font-medium" : "text-gray-300"
            )}>Visualize</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline truncate max-w-[120px]">{parsedData.fileName}</span>
            <span className="font-medium text-gray-600">{parsedData.rowCount.toLocaleString()} rows</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <AnimatePresence mode="wait">

          {/* ── INPUT STAGE ─────────────────────────────────────────────── */}
          {stage === "input" && (
            <motion.div key="input"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="max-w-2xl mx-auto"
            >

              {/* ── Uploaded files card ───────────────────────────────────── */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  {parsedDataArray.length > 1 ? `Uploaded Files (${parsedDataArray.length})` : "Uploaded File"}
                </p>
                <div className="space-y-2">
                  {parsedDataArray.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFileIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                        selectedFileIndex === idx
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        selectedFileIndex === idx ? "bg-indigo-100" : "bg-gray-100"
                      )}>
                        <FileText className={cn("w-4 h-4", selectedFileIndex === idx ? "text-indigo-600" : "text-gray-400")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", selectedFileIndex === idx ? "text-indigo-700" : "text-gray-700")}>
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {file.rowCount.toLocaleString()} rows · {file.columns.length} columns
                        </p>
                      </div>
                      {selectedFileIndex === idx && (
                        <span className="shrink-0 text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <FlaskConical className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1.5">EDA Analysis</h1>
                <p className="text-gray-500 text-sm">
                  Tell Claude what this dataset is about and what you want to understand.
                  It will auto-clean, transform, and profile every column.
                </p>
              </div>

              {error && (
                <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* What EDA does */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400" /> What EDA does automatically
                </p>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-gray-600">
                  {[
                    { icon: <Binary className="w-3.5 h-3.5 text-amber-500" />,   text: "Decode binary (0/1) → meaningful labels" },
                    { icon: <Layers className="w-3.5 h-3.5 text-indigo-500" />,  text: "Group scale columns into Low/Medium/High ranges" },
                    { icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />, text: "Detect and flag outliers via IQR method" },
                    { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />, text: "Impute missing values (median / mode)" },
                    { icon: <RefreshCw className="w-3.5 h-3.5 text-blue-400" />, text: "Remove duplicate rows automatically" },
                    { icon: <Database className="w-3.5 h-3.5 text-violet-500" />, text: "Fix data types (strings → numbers / dates)" },
                  ].map(({ icon, text }, i) => (
                    <div key={i} className="flex items-start gap-2">{icon}<span>{text}</span></div>
                  ))}
                </div>
              </div>

              {/* Description input */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Describe your dataset & what you want to find
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. This is a teen mental health survey dataset. I want to understand how social media usage relates to depression and anxiety levels, and how addiction_level varies by age group."
                  rows={4}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 resize-none shadow-sm"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  The more detail you provide, the smarter the binary label decoding and range grouping will be.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={startEda}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-indigo-200"
                >
                  <FlaskConical className="w-5 h-5" />
                  Run EDA Analysis
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={handleVisualizeDirectly}
                  className="w-full py-3 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <Zap className="w-4 h-4" />
                  Skip EDA — Visualize Directly
                </button>
              </div>

            </motion.div>
          )}

          {/* ── RUNNING ─────────────────────────────────────────────────── */}
          {stage === "running" && (
            <motion.div key="running"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 gap-6"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl animate-pulse">
                <FlaskConical className="w-10 h-10 text-white" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Running EDA Analysis…</h2>
                <p className="text-gray-500 text-sm max-w-xs">
                  Classifying {parsedData.columns.length} columns, imputing nulls, decoding binary fields, detecting outliers…
                </p>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── REPORT ──────────────────────────────────────────────────── */}
          {stage === "report" && edaResult && (
            <motion.div key="report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">EDA Report</h1>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {parsedData.fileName} · {edaResult.eda_summary.clean_rows.toLocaleString()} clean rows after transformations
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEdaResult(null); setStage("input"); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded-xl text-xs font-medium transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Re-run EDA
                  </button>
                  <button
                    onClick={() => {
                      const rows = edaResult?.clean_rows?.length ? edaResult.clean_rows : cleanRows;
                      if (rows.length) downloadCleanedCSV(rows, parsedData.fileName);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Cleaned CSV
                  </button>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Original Rows",     value: edaResult.eda_summary.original_rows.toLocaleString(),  color: "gray"    },
                  { label: "Duplicates Removed", value: edaResult.eda_summary.duplicates_removed,             color: edaResult.eda_summary.duplicates_removed > 0 ? "amber" : "gray" },
                  { label: "Clean Rows",         value: edaResult.eda_summary.clean_rows.toLocaleString(),    color: "emerald" },
                  { label: "Columns Analyzed",   value: edaResult.eda_summary.columns_analyzed,              color: "blue"    },
                ].map(({ label, value, color }) => (
                  <div key={label} className={cn("bg-white border rounded-2xl p-4 text-center shadow-sm",
                    color === "emerald" ? "border-emerald-200 bg-emerald-50"
                      : color === "amber" ? "border-amber-200 bg-amber-50"
                      : color === "blue" ? "border-blue-200 bg-blue-50"
                      : "border-gray-100"
                  )}>
                    <p className={cn("text-2xl font-bold mb-1",
                      color === "emerald" ? "text-emerald-700" : color === "amber" ? "text-amber-700"
                        : color === "blue" ? "text-blue-700" : "text-gray-800"
                    )}>{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              {/* Insights */}
              {edaResult.eda_insights.length > 0 && (
                <div className="mb-6"><EDAInsightsList insights={edaResult.eda_insights} /></div>
              )}

              {/* Outliers */}
              {edaResult.outlier_report.length > 0 && (
                <div className="mb-6"><OutlierReport outliers={edaResult.outlier_report} /></div>
              )}

              {/* Binary decodings */}
              {edaResult.binary_decodings.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Binary className="w-4 h-4 text-amber-500" /> Binary Decodings
                  </h2>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {["Column", "0 → Label", "1 → Label"].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {edaResult.binary_decodings.map((b) => (
                          <tr key={b.column} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-800">{b.column}</td>
                            <td className="px-4 py-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">0 → {b["0_label"]}</span></td>
                            <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">1 → {b["1_label"]}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Range groupings */}
              {edaResult.range_groupings.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" /> Range Groupings Created
                  </h2>
                  <div className="space-y-3">
                    {edaResult.range_groupings.map((rg) => (
                      <div key={rg.original_column} className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="font-medium text-gray-800 text-sm">{rg.original_column}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-indigo-600 font-semibold text-sm">{rg.new_column}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(rg.buckets).map(([label, range]) => (
                            <span key={label} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs rounded-full font-medium">
                              <span className="font-bold">{label}:</span> {range}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Column profiles */}
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" /> Column Profiles ({edaResult.column_profiles.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {edaResult.column_profiles.map((profile, i) => (
                    <ColumnProfileCard key={profile.name} profile={profile} index={i} />
                  ))}
                </div>
              </div>

              {/* Excluded columns */}
              {edaResult.excluded_columns.length > 0 && (
                <div className="mb-8 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Excluded from Visualization</p>
                  <div className="flex flex-wrap gap-2">
                    {edaResult.excluded_columns.map((col) => (
                      <span key={col} className="px-2.5 py-1 bg-gray-200 text-gray-500 rounded-lg text-xs">{col}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── VISUALIZE SECTION ──────────────────────────────────── */}
              <div className="border-t-2 border-dashed border-indigo-200 pt-8 mt-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Now Visualize Your Data</h2>
                    <p className="text-sm text-gray-500">Claude will use the cleaned, transformed dataset to build your dashboard</p>
                  </div>
                </div>

                {/* Domain chips */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Select domain</p>
                  <div className="flex flex-wrap gap-2">
                    {visibleDomains.map((d) => (
                      <button key={d.value} onClick={() => setVizDomain(d.value)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                          vizDomain === d.value
                            ? "border-blue-400 bg-blue-50 text-blue-700 shadow-sm"
                            : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"
                        )}
                      >
                        <span>{d.icon}</span> {d.label}
                        {d.value === "auto" && <span className="text-[10px] text-gray-400">(recommended)</span>}
                      </button>
                    ))}
                    <button onClick={() => setShowMoreDomains(!showMoreDomains)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-xl transition-colors"
                    >
                      {showMoreDomains ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showMoreDomains ? "Less" : "More"}
                    </button>
                  </div>
                </div>

                {/* Viz query */}
                <div className="mb-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">What do you want to see?</p>
                  <textarea
                    value={vizQuery}
                    onChange={(e) => setVizQuery(e.target.value)}
                    placeholder="e.g. Show how addiction level groups relate to depression rates, visualize sleep hours distribution, show anxiety by platform usage..."
                    rows={3}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 resize-none transition-all shadow-sm"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Claude will use the cleaned data (with decoded columns and grouped ranges) to build charts.
                  </p>
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      const rows = edaResult?.clean_rows?.length ? edaResult.clean_rows : cleanRows;
                      if (rows.length) downloadCleanedCSV(rows, parsedData.fileName);
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium transition-all"
                  >
                    <Download className="w-4 h-4" /> Download Cleaned CSV
                  </button>
                  <button
                    onClick={proceedToDashboard}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-200"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Dashboard with Claude
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
