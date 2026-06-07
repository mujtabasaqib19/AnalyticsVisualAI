"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, CheckCircle, ArrowRight, BarChart3, Sparkles,
  AlertCircle, FileText, FlaskConical, Zap,
} from "lucide-react";
import { parseFile } from "@/lib/parser";
import { useDashboardStore } from "@/store/dashboardStore";
import { useEdaStore } from "@/store/edaStore";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ACCEPTED_TYPES: Record<string, string[]> = {
  "text/csv":                                                                       [".csv"],
  "text/tab-separated-values":                                                      [".tsv"],
  "text/plain":                                                                     [".txt"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":              [".xlsx"],
  "application/vnd.ms-excel":                                                       [".xls"],
  "application/json":                                                               [".json"],
};

export default function UploadPage() {
  const router = useRouter();
  const { addParsedData, removeFileByIndex, setSelectedFileIndex,
          setUserQuery, setDashboardType, setStatus, setErrorMessage } = useDashboardStore();
  const { clearEda } = useEdaStore();

  const parsedDataArray  = useDashboardStore((s) => s.parsedDataArray);
  const selectedFileIndex = useDashboardStore((s) => s.selectedFileIndex);
  const parsedData       = useDashboardStore((s) => s.parsedData);

  const [parseError,     setParseError]     = useState<string | null>(null);
  const [isParsing,      setIsParsing]      = useState(false);
  // "none" = no file yet, "choose" = file ready choose path, "visualize" = show viz form
  const [mode, setMode] = useState<"none" | "choose" | "visualize">("none");

  // Visualize form state
  const [query, setQuery] = useState("");

  // ── File drop ─────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setParseError(null);
    try {
      for (const f of accepted) {
        setIsParsing(true);
        const parsed = await parseFile(f);
        addParsedData(parsed);
        clearEda();
        setIsParsing(false);
      }
      setMode("choose");
    } catch (e) {
      setParseError((e as Error).message);
      setIsParsing(false);
    }
  }, [addParsedData, clearEda]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 2 * 1024 * 1024 * 1024,
  });

  // ── Go to EDA ─────────────────────────────────────────────────────────────
  const handleGoEda = () => {
    if (!parsedData) return;
    setStatus("idle");
    setErrorMessage(null);
    router.push("/eda");
  };

  // ── Go to Dashboard (Visualize directly) ─────────────────────────────────
  const handleVisualize = () => {
    if (!parsedData) return;
    setUserQuery(query.trim() || "Give me a full overview dashboard of this dataset");
    setDashboardType("auto");   // always auto — Claude infers domain from data
    setStatus("idle");
    setErrorMessage(null);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-gray-900">
              Analytics<span className="text-blue-600">Visual</span>AI
            </span>
          </Link>
          <span className="text-xs text-gray-400 hidden sm:block">Upload → Analyze → Visualize</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-normal text-gray-900 mb-2">Upload Your Data</h1>
          <p className="text-gray-400 text-lg font-light">
            CSV, Excel, or JSON — Claude auto-detects your domain and builds the dashboard
          </p>
        </motion.div>

        {/* ── Dropzone ────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-4">
          <div
            {...getRootProps()}
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all",
              isDragActive  ? "border-blue-400 bg-blue-50"
              : parsedData  ? "border-emerald-400 bg-emerald-50"
              : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 bg-white"
            )}
          >
            <input {...getInputProps()} />
            <AnimatePresence mode="wait">
              {isParsing ? (
                <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3 animate-pulse">
                    <Sparkles className="w-6 h-6 text-blue-500" />
                  </div>
                  <p className="text-gray-500 text-sm">Reading your file…</p>
                </motion.div>
              ) : parsedData ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <p className="font-semibold text-emerald-700">{parsedData.fileName}</p>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {parsedData.rowCount.toLocaleString()} rows × {parsedData.columns.length} columns detected
                  </p>
                  <p className="text-xs text-gray-400">Drop another file to add it, or choose an action below</p>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                  {isDragActive ? (
                    <p className="text-blue-600 font-medium">Drop it here!</p>
                  ) : (
                    <>
                      <p className="font-medium text-gray-700 mb-1">Drop your file here</p>
                      <p className="text-sm text-gray-400">or click to browse</p>
                      <p className="text-xs text-gray-300 mt-3">CSV · XLSX · XLS · JSON — up to 2 GB</p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {parseError && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0" /> {parseError}
            </motion.div>
          )}
        </motion.div>

        {/* ── Multiple files list ──────────────────────────────────────────── */}
        <AnimatePresence>
          {parsedDataArray.length > 1 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Uploaded Files ({parsedDataArray.length})</p>
                <div className="space-y-2">
                  {parsedDataArray.map((file, idx) => (
                    <div key={idx} onClick={() => setSelectedFileIndex(idx)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                        selectedFileIndex === idx ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-200"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 shrink-0 text-gray-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{file.fileName}</p>
                          <p className="text-xs text-gray-400">{file.rowCount.toLocaleString()} rows × {file.columns.length} cols</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFileByIndex(idx); }}
                        className="text-gray-400 hover:text-red-600 transition-colors shrink-0 ml-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Columns preview ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {parsedData && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
              <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Detected Columns</p>
                <div className="flex flex-wrap gap-2">
                  {parsedData.columns.map((col) => (
                    <span key={col.name} className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
                      col.type === "numeric" ? "bg-blue-50 border-blue-200 text-blue-700"
                        : col.type === "date" ? "bg-violet-50 border-violet-200 text-violet-700"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    )}>
                      <span>{col.type === "numeric" ? "#" : col.type === "date" ? "📅" : "T"}</span>
                      {col.name}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Path selector (shown after upload) ──────────────────────────── */}
        <AnimatePresence>
          {parsedData && mode !== "none" && (
            <motion.div
              key="path-selector"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-6"
            >
              <p className="text-sm font-semibold text-gray-700 mb-4 text-center">How would you like to proceed?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* EDA Card */}
                <button
                  onClick={handleGoEda}
                  className="group relative flex flex-col gap-3 p-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl text-left transition-all hover:shadow-xl hover:scale-[1.02] border-2 border-transparent"
                >
                  <div className="absolute top-3 right-3 bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Recommended
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                    <FlaskConical className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-base mb-1">Do EDA First</p>
                    <p className="text-indigo-100 text-sm leading-relaxed">
                      AI-powered cleaning — Gemini classifies every column, decodes binary fields, groups scale columns, and detects outliers before visualization.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-white text-sm font-medium mt-auto group-hover:gap-2.5 transition-all">
                    <Sparkles className="w-4 h-4" /> Start EDA Analysis <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {/* Visualize Card */}
                <button
                  onClick={() => setMode("visualize")}
                  className={cn(
                    "group flex flex-col gap-3 p-6 bg-white rounded-2xl text-left transition-all hover:shadow-md border-2",
                    mode === "visualize" ? "border-blue-400 shadow-md" : "border-gray-200 hover:border-blue-300"
                  )}
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-base mb-1">Visualize Directly</p>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Skip analysis and jump straight to dashboard generation. Best when your data is already clean.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-600 text-sm font-medium mt-auto group-hover:gap-2.5 transition-all">
                    <BarChart3 className="w-4 h-4" />
                    {mode === "visualize" ? "Fill in details below ↓" : "Set up dashboard →"}
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Visualize form (expands when Visualize is chosen) ────────────── */}
        <AnimatePresence>
          {mode === "visualize" && parsedData && (
            <motion.div
              key="viz-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-5 pt-2">

                {/* Query */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">2</div>
                    <p className="text-sm font-semibold text-gray-700">Describe your dashboard</p>
                    <span className="text-xs text-gray-400">(optional)</span>
                  </div>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe what you want to see — or leave blank and Claude will decide"
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 resize-none transition-all"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Claude will auto-detect the domain from your column names and data — no need to select it manually.
                  </p>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleVisualize}
                  className="w-full py-4 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all shadow-md bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Dashboard with Claude
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
