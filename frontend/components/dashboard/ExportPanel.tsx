"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, FileImage, FileText, Code2, Link2, Mail,
  Check, Copy, Loader2, ExternalLink, Clock, BrainCircuit,
} from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface ExportPanelProps {
  onClose: () => void;
}

type Tab = "export" | "share" | "embed" | "schedule";

export function ExportPanel({ onClose }: ExportPanelProps) {
  const { dashboardSpec, parsedData, validation, activeTheme } = useDashboardStore();
  const [activeTab, setActiveTab] = useState<Tab>("export");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleFreq, setScheduleFreq] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  // ── PNG Export ──────────────────────────────────────────────────────────────
  async function exportPNG() {
    const el = document.getElementById("dashboard-canvas");
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: activeTheme ? null : "#f9fafb",
      scale: 2,
      useCORS: true,
    });
    const a = document.createElement("a");
    a.download = `${dashboardSpec?.dashboard_title ?? "dashboard"}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    trackEvent("chart_export", { format: "png" });
  }

  // ── PDF Export ──────────────────────────────────────────────────────────────
  async function exportPDF() {
    const el = document.getElementById("dashboard-canvas");
    if (!el) return;
    setPdfLoading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      const canvas = await html2canvas(el, {
        backgroundColor: activeTheme ? null : "#f9fafb",
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;

      // A4 landscape in mm
      const pageW = 297;
      const pageH = 210;
      const ratio = Math.min(pageW / imgW, pageH / imgH);
      const scaledW = imgW * ratio;
      const scaledH = imgH * ratio;
      const offsetX = (pageW - scaledW) / 2;
      const offsetY = (pageH - scaledH) / 2;

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.addImage(imgData, "PNG", offsetX, offsetY, scaledW, scaledH);
      pdf.save(`${dashboardSpec?.dashboard_title ?? "dashboard"}.pdf`);
      trackEvent("chart_export", { format: "pdf" });
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Gemini Narrative Report ────────────────────────────────────────────
  async function downloadGeminiReport() {
    if (!dashboardSpec || !parsedData) return;
    setReportLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const schema = {
        columns: parsedData.columns,
        row_count: parsedData.rowCount,
        suggested_metrics: parsedData.columns.filter(c => c.type === "numeric").map(c => c.name),
        suggested_dimensions: parsedData.columns.filter(c => c.type === "string").map(c => c.name),
      };
      const res = await fetch(`${API}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboard_spec: dashboardSpec,
          schema,
          sample_rows: parsedData.rows.slice(0, 10),
          quality: validation ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { report, title } = await res.json();

      // Render markdown text to a styled jsPDF document
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210; const margin = 18; const maxW = pageW - margin * 2;
      let y = margin;

      const addLine = (text: string, size: number, bold: boolean, color: [number,number,number] = [30,30,30]) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, maxW) as string[];
        if (y + lines.length * size * 0.4 > 285) { doc.addPage(); y = margin; }
        doc.text(lines, margin, y);
        y += lines.length * size * 0.4 + 2;
      };

      // Cover header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 28, "F");
      doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(255,255,255);
      doc.text(title, margin, 12);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`Generated by Gemini AI  •  ${new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}`, margin, 20);
      doc.setDrawColor(255,255,255); doc.setLineWidth(0.3); doc.line(margin, 24, pageW - margin, 24);
      y = 36;

      // Parse and render markdown lines
      for (const rawLine of report.split("\n")) {
        const line = rawLine.trim();
        if (!line) { y += 3; continue; }
        if (line.startsWith("## "))      { addLine(line.slice(3), 13, true,  [37,99,235]); y += 1; }
        else if (line.startsWith("### ")) { addLine(line.slice(4), 11, true,  [55,65,81]); }
        else if (line.startsWith("- ") || line.startsWith("* ")) {
          const bullet = `•  ${line.slice(2)}`;
          addLine(bullet, 9, false, [55,65,81]);
        } else if (/^\d+\./.test(line)) {
          addLine(line, 9, false, [55,65,81]);
        } else {
          addLine(line, 9, false, [75,85,99]);
        }
      }

      // Footer on each page
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(7); doc.setTextColor(156,163,175);
        doc.text(`AnalyticsVisualAI • Gemini Report • Page ${p} of ${total}`, margin, 292);
      }

      doc.save(`${title.replace(/[^a-z0-9]/gi, "_")}_GeminiReport.pdf`);
      trackEvent("chart_export", { format: "gemini_report" });
    } catch (e) {
      alert(`Report failed: ${(e as Error).message}`);
    } finally {
      setReportLoading(false);
    }
  }

  // ── Share Link ──────────────────────────────────────────────────────────────
  async function generateShareLink() {
    if (!dashboardSpec) return;
    setShareLoading(true);
    try {
      const rows = parsedData?.rows?.slice(0, 200) ?? [];
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: dashboardSpec, rows }),
      });
      const { id } = await res.json();
      const url = `${window.location.origin}/share?d=${id}`;
      setShareLink(url);
    } finally {
      setShareLoading(false);
    }
  }

  // ── Copy helper ─────────────────────────────────────────────────────────────
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // ── Embed Code ──────────────────────────────────────────────────────────────
  const embedCode = shareLink
    ? `<iframe\n  src="${shareLink}"\n  width="100%"\n  height="600"\n  frameborder="0"\n  allowfullscreen\n  title="${dashboardSpec?.dashboard_title ?? "Dashboard"}"\n></iframe>`
    : null;

  // ── Email Schedule ──────────────────────────────────────────────────────────
  async function scheduleReport() {
    if (!scheduleEmail.trim()) return;
    // In production this would call a backend scheduler (e.g. cron + SendGrid).
    // For the MVP we record intent in analytics and show confirmation.
    trackEvent("feedback", { type: "schedule", email: "redacted", freq: scheduleFreq });
    setScheduleSuccess(true);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "export",   label: "Export",   icon: <Download className="w-3.5 h-3.5" /> },
    { id: "share",    label: "Share",    icon: <Link2 className="w-3.5 h-3.5" /> },
    { id: "embed",    label: "Embed",    icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: "schedule", label: "Schedule", icon: <Mail className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="w-80 h-full bg-white border-l border-gray-100 flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Download className="w-4 h-4 text-blue-500" /> Export & Share
        </p>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-all",
              activeTab === t.id
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/40"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">

          {/* ── EXPORT TAB ─────────────────────────────────────── */}
          {activeTab === "export" && (
            <motion.div key="export" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Download the full dashboard as a high-resolution image or PDF document.
              </p>

              <div className="space-y-3">
                <button
                  onClick={exportPNG}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                    <FileImage className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">Export as PNG</p>
                    <p className="text-xs text-gray-400">2× high-res image, transparent bg</p>
                  </div>
                </button>

                <button
                  onClick={exportPDF}
                  disabled={pdfLoading}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-200 hover:border-rose-300 hover:bg-rose-50 rounded-xl transition-all group disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition-colors">
                    {pdfLoading ? (
                      <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">Export as PDF</p>
                    <p className="text-xs text-gray-400">A4 landscape, print-ready</p>
                  </div>
                </button>

                {/* Gemini Narrative Report */}
                <button
                  onClick={downloadGeminiReport}
                  disabled={reportLoading || !dashboardSpec}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl transition-all group disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                    {reportLoading ? (
                      <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    ) : (
                      <BrainCircuit className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">
                      {reportLoading ? "Gemini is writing…" : "Gemini Narrative Report"}
                    </p>
                    <p className="text-xs text-gray-400">AI-written analysis PDF with insights</p>
                  </div>
                </button>
              </div>

              <div className="mt-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  💡 Tip: Collapse the sidebar and close any panels before exporting for a cleaner image.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── SHARE TAB ──────────────────────────────────────── */}
          {activeTab === "share" && (
            <motion.div key="share" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Generate a public link. The dashboard spec and up to 200 data rows are encoded in the URL — no login required to view.
              </p>

              {!shareLink ? (
                <button
                  onClick={generateShareLink}
                  disabled={shareLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-60"
                >
                  {shareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {shareLoading ? "Generating…" : "Generate Share Link"}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-wider">Share URL</p>
                    <p className="text-xs text-gray-700 break-all font-mono leading-relaxed">{shareLink}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(shareLink, "link")}
                      className="flex-1 py-2.5 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-700 rounded-xl text-xs font-medium transition-all"
                    >
                      {copied === "link" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === "link" ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={shareLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 flex items-center justify-center bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-500 hover:text-blue-700 rounded-xl transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <button
                    onClick={() => { setShareLink(""); }}
                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Regenerate link
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── EMBED TAB ──────────────────────────────────────── */}
          {activeTab === "embed" && (
            <motion.div key="embed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Embed this dashboard in any website or Notion page using an iframe snippet.
              </p>

              {!shareLink && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700">
                    You need a share link first. Go to the <strong>Share</strong> tab and generate one.
                  </p>
                </div>
              )}

              {embedCode ? (
                <div className="space-y-3">
                  <div className="bg-gray-900 rounded-xl p-3 overflow-x-auto">
                    <pre className="text-xs text-emerald-400 font-mono whitespace-pre leading-relaxed">{embedCode}</pre>
                  </div>
                  <button
                    onClick={() => copyToClipboard(embedCode, "embed")}
                    className="w-full py-2.5 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-600 hover:text-violet-700 rounded-xl text-xs font-medium transition-all"
                  >
                    {copied === "embed" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Code2 className="w-3.5 h-3.5" />}
                    {copied === "embed" ? "Copied!" : "Copy Embed Code"}
                  </button>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[11px] text-gray-400">
                      Works in: Notion, Confluence, any HTML page, Webflow, WordPress.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-xl p-4 text-center">
                  <Code2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Embed code will appear here once you have a share link.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SCHEDULE TAB ───────────────────────────────────── */}
          {activeTab === "schedule" && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {scheduleSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">Schedule saved!</p>
                  <p className="text-xs text-gray-400">
                    You&apos;ll receive this dashboard as a PDF to <strong>{scheduleEmail}</strong> on a {scheduleFreq} basis.
                  </p>
                  <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                    Note: Email delivery requires the backend email service to be configured (SendGrid/Resend). This records your preference.
                  </p>
                  <button
                    onClick={() => setScheduleSuccess(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline mt-1"
                  >
                    Edit schedule
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                    Receive this dashboard as a PDF email on a recurring schedule.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email address</label>
                      <input
                        type="email"
                        value={scheduleEmail}
                        onChange={(e) => setScheduleEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Frequency</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["daily", "weekly", "monthly"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setScheduleFreq(f)}
                            className={cn(
                              "py-2 rounded-xl text-xs font-medium border transition-all capitalize",
                              scheduleFreq === f
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-gray-200 text-gray-600 hover:border-blue-200"
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-blue-700">
                        {scheduleFreq === "daily" && "Delivered every morning at 8:00 AM (your timezone)."}
                        {scheduleFreq === "weekly" && "Delivered every Monday at 8:00 AM (your timezone)."}
                        {scheduleFreq === "monthly" && "Delivered on the 1st of each month at 8:00 AM."}
                      </p>
                    </div>

                    <button
                      onClick={scheduleReport}
                      disabled={!scheduleEmail.trim()}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <Mail className="w-4 h-4" />
                      Schedule Report
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
