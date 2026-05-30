"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Sparkles, RefreshCw, Shield, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, X, Wand2,
} from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import type { DashboardTheme } from "@/app/api/theme/route";
import type { GeminiThemeAudit } from "@/app/api/theme/route";
import { cn } from "@/lib/utils";

// ── Preset prompt suggestions ─────────────────────────────────────────────────
const THEME_PRESETS = [
  { label: "Ocean Gradient", prompt: "Deep ocean blue to teal gradient background, white cards, vibrant cyan chart accents" },
  { label: "Sunset Warm", prompt: "Warm sunset orange to pink gradient canvas, cream white cards, coral and amber chart colours" },
  { label: "Midnight Dark", prompt: "Very dark navy background, dark card surfaces, neon electric blue and violet chart colours" },
  { label: "Forest Green", prompt: "Deep forest green gradient, light sage card backgrounds, rich green and gold chart palette" },
  { label: "Monochrome Pro", prompt: "Pure white background, light grey cards with subtle shadows, charcoal and slate chart colours" },
  { label: "Neon Cyber", prompt: "Dark black background, dark grey cards, neon pink magenta and electric green chart colours" },
  { label: "Pastel Soft", prompt: "Very light lavender gradient background, pure white cards, muted pastel purple blue peach chart palette" },
  { label: "Corporate Blue", prompt: "Clean white background, white cards with blue border accents, professional navy and sky-blue chart colours" },
];

interface ThemePanelProps {
  onClose: () => void;
}

export function ThemePanel({ onClose }: ThemePanelProps) {
  const { activeTheme, setActiveTheme } = useDashboardStore();

  const [prompt, setPrompt]             = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [audit, setAudit]               = useState<GeminiThemeAudit | null>(null);
  const [showAudit, setShowAudit]       = useState(false);
  const [previewTheme, setPreviewTheme] = useState<DashboardTheme | null>(null);

  const displayedTheme = previewTheme ?? activeTheme;

  async function generateTheme(userPrompt: string) {
    if (!userPrompt.trim()) return;
    setIsLoading(true);
    setError(null);
    setAudit(null);
    setShowAudit(false);

    try {
      const res = await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt, currentTheme: activeTheme }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Theme generation failed");

      setPreviewTheme(data.theme as DashboardTheme);
      setAudit(data.audit as GeminiThemeAudit);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function applyTheme() {
    if (!previewTheme) return;
    setActiveTheme(previewTheme);
    setPreviewTheme(null);
    onClose();
  }

  function discardPreview() {
    setPreviewTheme(null);
    setAudit(null);
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-100 flex flex-col overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60 shrink-0">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm text-gray-800">Theme Studio</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Prompt input */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Describe your theme
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateTheme(prompt); }
            }}
            placeholder="e.g. Dark navy gradient with neon cyan accents and bright chart colours..."
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 resize-none transition-all"
          />

          <button
            onClick={() => generateTheme(prompt)}
            disabled={!prompt.trim() || isLoading}
            className="mt-2 w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {isLoading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generating with Claude…</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Generate Theme</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{error}
          </motion.div>
        )}

        {/* Quick presets */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Presets</p>
          <div className="grid grid-cols-2 gap-1.5">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { setPrompt(p.prompt); generateTheme(p.prompt); }}
                className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50 text-gray-600 hover:text-violet-700 transition-all text-left leading-tight"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview swatch */}
        <AnimatePresence>
          {displayedTheme && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {previewTheme ? "Preview" : "Active Theme"}
                </p>
                {!previewTheme && activeTheme && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Applied
                  </span>
                )}
              </div>

              {/* Canvas preview strip */}
              <div
                className="rounded-xl overflow-hidden border border-gray-200 mb-3"
                style={{ background: displayedTheme.canvasBg }}
              >
                {/* Mini card */}
                <div
                  className="m-2 rounded-lg p-3 border"
                  style={{
                    background: displayedTheme.cardBg,
                    borderColor: displayedTheme.cardBorder,
                  }}
                >
                  <div
                    className="rounded-t-lg px-2 py-1 mb-2 -mx-3 -mt-3 text-[10px] font-medium"
                    style={{
                      background: displayedTheme.cardHeaderBg,
                      color: displayedTheme.cardText,
                      borderBottom: `1px solid ${displayedTheme.cardBorder}`,
                    }}
                  >
                    {displayedTheme.name}
                  </div>
                  {/* Mini bar chart */}
                  <div className="flex items-end gap-1 h-10">
                    {displayedTheme.chartColors.slice(0, 6).map((c, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{ backgroundColor: c, height: `${30 + i * 8}%` }}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] mt-1" style={{ color: displayedTheme.cardTextMuted }}>
                    {displayedTheme.description}
                  </p>
                </div>
              </div>

              {/* Colour swatches */}
              <div className="mb-3">
                <p className="text-[10px] text-gray-400 mb-1.5">Chart palette</p>
                <div className="flex gap-1 flex-wrap">
                  {displayedTheme.chartColors.map((c, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-md border border-gray-200 shadow-sm"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Gemini audit badge */}
              {audit && (
                <div className={cn(
                  "rounded-xl border p-3 mb-3 text-xs",
                  audit.approved
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-amber-50 border-amber-200"
                )}>
                  <button
                    onClick={() => setShowAudit(!showAudit)}
                    className="w-full flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Shield className={cn("w-3.5 h-3.5", audit.approved ? "text-emerald-600" : "text-amber-600")} />
                      <span className={audit.approved ? "text-emerald-700" : "text-amber-700"}>
                        Gemini Audit — {audit.approved ? "Passed" : "Fixed Issues"}
                      </span>
                    </span>
                    {showAudit
                      ? <ChevronUp className="w-3 h-3 text-gray-400" />
                      : <ChevronDown className="w-3 h-3 text-gray-400" />}
                  </button>

                  <AnimatePresence>
                    {showAudit && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mt-2 space-y-2"
                      >
                        {audit.contrastIssues.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-amber-700 mb-1">Contrast Issues Fixed</p>
                            {audit.contrastIssues.map((i, idx) => (
                              <p key={idx} className="text-[10px] text-amber-600 flex items-start gap-1">
                                <AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" />{i}
                              </p>
                            ))}
                          </div>
                        )}
                        {audit.securityNotes.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-red-700 mb-1">Security / Integrity Notes</p>
                            {audit.securityNotes.map((n, idx) => (
                              <p key={idx} className="text-[10px] text-red-600">{n}</p>
                            ))}
                          </div>
                        )}
                        {audit.suggestions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-600 mb-1">Suggestions</p>
                            {audit.suggestions.map((s, idx) => (
                              <p key={idx} className="text-[10px] text-gray-500 flex items-start gap-1">
                                <Sparkles className="w-2.5 h-2.5 mt-0.5 shrink-0 text-violet-400" />{s}
                              </p>
                            ))}
                          </div>
                        )}
                        {Object.keys(audit.overrides).length > 0 && (
                          <p className="text-[10px] text-emerald-700">
                            ✔ {Object.keys(audit.overrides).length} value(s) auto-corrected by Gemini
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Apply / Discard */}
              {previewTheme && (
                <div className="flex gap-2">
                  <button
                    onClick={applyTheme}
                    className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Apply Theme
                  </button>
                  <button
                    onClick={discardPreview}
                    className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-500 text-xs rounded-xl transition-all"
                  >
                    Discard
                  </button>
                </div>
              )}

              {/* Reset to default */}
              {activeTheme && !previewTheme && (
                <button
                  onClick={() => { setActiveTheme(null); onClose(); }}
                  className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-500 text-xs rounded-xl transition-all"
                >
                  Reset to Default
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
