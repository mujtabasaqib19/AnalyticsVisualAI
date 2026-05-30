"use client";

import { motion } from "framer-motion";
import {
  TrendingUp, AlertTriangle, Hash, Tag, Calendar,
  Binary, BarChart2, Layers, Fingerprint,
} from "lucide-react";
import type { ColumnProfile } from "@/lib/eda";
import { cn } from "@/lib/utils";

interface Props {
  profile: ColumnProfile;
  index: number;
}

const CLF_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  categorical:              { icon: <Tag className="w-3.5 h-3.5" />,      color: "violet", label: "Categorical"         },
  binary:                   { icon: <Binary className="w-3.5 h-3.5" />,   color: "amber",  label: "Binary"             },
  numeric_continuous:       { icon: <TrendingUp className="w-3.5 h-3.5" />, color: "blue", label: "Numeric (Continuous)"},
  numeric_discrete:         { icon: <Hash className="w-3.5 h-3.5" />,     color: "cyan",   label: "Numeric (Discrete)" },
  high_cardinality_numeric: { icon: <Layers className="w-3.5 h-3.5" />,   color: "indigo", label: "High Cardinality"   },
  date:                     { icon: <Calendar className="w-3.5 h-3.5" />, color: "emerald",label: "Date"               },
  id_column:                { icon: <Fingerprint className="w-3.5 h-3.5" />, color: "gray", label: "ID (excluded)"     },
};

const COLOR_CLASSES: Record<string, string> = {
  violet:  "bg-violet-50 border-violet-200 text-violet-700",
  amber:   "bg-amber-50 border-amber-200 text-amber-700",
  blue:    "bg-blue-50 border-blue-200 text-blue-700",
  cyan:    "bg-cyan-50 border-cyan-200 text-cyan-700",
  indigo:  "bg-indigo-50 border-indigo-200 text-indigo-700",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  gray:    "bg-gray-50 border-gray-200 text-gray-500",
};

export function ColumnProfileCard({ profile, index }: Props) {
  const meta = CLF_META[profile.classification] ?? CLF_META.categorical;
  const colorClass = COLOR_CLASSES[meta.color] ?? COLOR_CLASSES.gray;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{profile.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {profile.unique_count} unique · {profile.null_pct}% nulls
          </p>
        </div>
        <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium shrink-0", colorClass)}>
          {meta.icon}
          {meta.label}
        </span>
      </div>

      {/* Stats row */}
      {profile.classification !== "id_column" && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Mean",   value: profile.mean   != null ? profile.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })   : "—" },
            { label: "Median", value: profile.median != null ? profile.median.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—" },
            { label: "Mode",   value: profile.mode   != null ? String(profile.mode) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
              <p className="text-xs font-semibold text-gray-700 truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Transformation badge */}
      {profile.transformation_applied !== "none" && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Transformations</p>
          <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 leading-relaxed">
            {profile.transformation_applied}
          </p>
        </div>
      )}

      {/* Range buckets */}
      {profile.new_column_created && Object.keys(profile.range_buckets).length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Groups → <span className="text-indigo-600">{profile.new_column_created}</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(profile.range_buckets).map(([label, range]) => (
              <span key={label} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] rounded-full">
                {label}: {range}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <BarChart2 className="w-3 h-3" />
          {profile.recommended_chart}
        </span>
        {profile.has_outliers && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600">
            <AlertTriangle className="w-3 h-3" /> Outliers
          </span>
        )}
      </div>
    </motion.div>
  );
}
