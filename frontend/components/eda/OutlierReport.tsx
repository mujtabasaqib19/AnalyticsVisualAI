"use client";

import { AlertTriangle } from "lucide-react";
import type { OutlierEntry } from "@/lib/eda";

interface Props { outliers: OutlierEntry[] }

export function OutlierReport({ outliers }: Props) {
  if (!outliers.length) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" /> Outlier Report (IQR Method)
      </p>
      <div className="space-y-2">
        {outliers.map((o) => (
          <div key={o.column} className="flex items-center justify-between bg-white border border-amber-100 rounded-xl px-3 py-2">
            <span className="text-sm font-medium text-gray-700">{o.column}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600 font-semibold">
                {o.outlier_count} outlier{o.outlier_count !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠ Flagged</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-amber-600 mt-3">
        Outliers are flagged but not removed. Charts will show a ⚠ warning badge.
        You can cap, remove, or keep them before generating your dashboard.
      </p>
    </div>
  );
}
