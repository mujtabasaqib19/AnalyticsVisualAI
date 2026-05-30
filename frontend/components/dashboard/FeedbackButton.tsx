"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, MessageSquare, X, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useDashboardStore } from "@/store/dashboardStore";

export function FeedbackButton() {
  const { dashboardSpec } = useDashboardStore();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<"positive" | "negative" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Pulse the button 15s after dashboard loads to nudge user
  useEffect(() => {
    if (!dashboardSpec) return;
    const t = setTimeout(() => setPulse(true), 15_000);
    return () => clearTimeout(t);
  }, [dashboardSpec]);

  function submit() {
    if (!rating) return;
    trackEvent("feedback", {
      rating,
      comment: comment.slice(0, 500),
      dashboard: dashboardSpec?.dashboard_title ?? "unknown",
    });
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setRating(null);
      setComment("");
    }, 2000);
  }

  if (!dashboardSpec) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72"
          >
            {submitted ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-gray-800">Thanks for your feedback!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">Was this dashboard helpful?</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex gap-3 mb-3">
                  <button
                    onClick={() => setRating("positive")}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                      rating === "positive"
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/50 text-gray-500"
                    }`}
                  >
                    <ThumbsUp className="w-5 h-5" />
                    <span className="text-xs font-medium">Yes!</span>
                  </button>
                  <button
                    onClick={() => setRating("negative")}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                      rating === "negative"
                        ? "border-rose-400 bg-rose-50 text-rose-700"
                        : "border-gray-200 hover:border-rose-200 hover:bg-rose-50/50 text-gray-500"
                    }`}
                  >
                    <ThumbsDown className="w-5 h-5" />
                    <span className="text-xs font-medium">Not really</span>
                  </button>
                </div>

                {rating && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={
                        rating === "positive"
                          ? "What did you like? (optional)"
                          : "What could be improved? (optional)"
                      }
                      rows={2}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none mb-2"
                    />
                    <button
                      onClick={submit}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all"
                    >
                      Submit Feedback
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <motion.button
        onClick={() => { setOpen(!open); setPulse(false); }}
        className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-full shadow-lg text-xs font-semibold transition-all ${
          open
            ? "bg-gray-700 text-white"
            : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
        }`}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Feedback
        {pulse && !open && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
        )}
      </motion.button>
    </div>
  );
}
