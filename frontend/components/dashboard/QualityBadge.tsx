"use client";

import { useState } from "react";
import { Shield, ChevronDown, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { getQualityColor } from "@/lib/utils";
import type { GeminiValidationResult } from "@/lib/gemini";
import { cn } from "@/lib/utils";

interface QualityBadgeProps {
  validation: GeminiValidationResult;
}

export function QualityBadge({ validation }: QualityBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const { text, bg, border, label } = getQualityColor(validation.quality_score);

  const Icon =
    validation.quality_score >= 80 ? CheckCircle
    : validation.quality_score >= 50 ? AlertTriangle
    : XCircle;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-sm",
          bg, border, text
        )}
      >
        <Shield className="w-3.5 h-3.5" />
        Gemini: {label}
        <span className="font-bold">{validation.quality_score}/100</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-100 p-4 z-50 shadow-xl bg-white">
          <div className="flex items-center gap-2 mb-3">
            <Icon className={cn("w-4 h-4", text)} />
            <span className={cn("font-semibold text-sm", text)}>
              Data Quality: {validation.quality_score}/100
            </span>
          </div>

          {validation.issues.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-red-500 mb-1.5 uppercase tracking-wide">Issues</p>
              <ul className="space-y-1">
                {validation.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-amber-600 mb-1.5 uppercase tracking-wide">Warnings</p>
              <ul className="space-y-1">
                {validation.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validation.recommendation && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 leading-relaxed">{validation.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
