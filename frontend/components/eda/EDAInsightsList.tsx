"use client";

import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

interface Props { insights: string[] }

export function EDAInsightsList({ insights }: Props) {
  if (!insights.length) return null;
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> EDA Insights
      </p>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="text-sm text-gray-700 bg-white/70 border border-blue-100 rounded-xl px-3 py-2 leading-relaxed"
          >
            {insight}
          </motion.p>
        ))}
      </div>
    </div>
  );
}
