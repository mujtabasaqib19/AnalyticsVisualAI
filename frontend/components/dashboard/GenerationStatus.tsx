"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle, XCircle, Database, Sparkles, Shield } from "lucide-react";
import type { GenerationStatus } from "@/store/dashboardStore";

const STEPS = [
  { key: "parsing", icon: Database, label: "Reading your data...", color: "text-blue-600" },
  { key: "validating", icon: Shield, label: "Gemini checking data quality...", color: "text-violet-600" },
  { key: "generating", icon: Sparkles, label: "Claude building your dashboard...", color: "text-amber-600" },
] as const;

interface GenerationStatusProps {
  status: GenerationStatus;
  errorMessage?: string | null;
}

export function GenerationStatusOverlay({ status, errorMessage }: GenerationStatusProps) {
  const isActive = ["parsing", "validating", "generating"].includes(status);
  const isError = status === "error";

  return (
    <AnimatePresence>
      {(isActive || isError) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 max-w-sm w-full mx-4 text-center"
          >
            {isError ? (
              <>
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg text-gray-900 mb-2">Generation Failed</h3>
                <p className="text-sm text-gray-500">{errorMessage || "Something went wrong. Please try again."}</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-6">Building Your Dashboard</h3>
                <div className="space-y-3 text-left">
                  {STEPS.map((step) => {
                    const stepIdx = STEPS.findIndex((s) => s.key === status);
                    const thisIdx = STEPS.findIndex((s) => s.key === step.key);
                    const isDone = thisIdx < stepIdx;
                    const isNow = step.key === status;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        {isDone ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : isNow ? (
                          <Loader2 className={`w-5 h-5 shrink-0 animate-spin ${step.color}`} />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
                        )}
                        <span className={`text-sm ${
                          isDone
                            ? "text-gray-300 line-through"
                            : isNow
                            ? `${step.color} font-medium`
                            : "text-gray-300"
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
