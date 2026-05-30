"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowRight, BarChart3, Upload, FlaskConical,
  Sparkles, Palette, Download, ChevronRight,
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string; // CSS selector of element to spotlight
  position: "center" | "top-right" | "bottom-right" | "bottom-left";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to AnalyticsVisualAI! 👋",
    description:
      "This quick tour will show you everything you can do. It only takes 30 seconds — promise.",
    icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
    position: "center",
  },
  {
    id: "upload",
    title: "Step 1 — Upload Your Data",
    description:
      "Drop any CSV, Excel, or JSON file. Our parser auto-detects column types, nulls, and schema.",
    icon: <Upload className="w-6 h-6 text-violet-500" />,
    position: "center",
  },
  {
    id: "eda",
    title: "Step 2 — Run EDA (optional)",
    description:
      "Our Exploratory Data Analysis engine auto-cleans your data: removes duplicates, fills nulls, decodes binary columns, and flags outliers.",
    icon: <FlaskConical className="w-6 h-6 text-indigo-500" />,
    position: "center",
  },
  {
    id: "generate",
    title: "Step 3 — Ask Claude",
    description:
      "Type a plain-English query like \"Show me monthly revenue by region\". Claude generates a full interactive dashboard in ~5 seconds.",
    icon: <Sparkles className="w-6 h-6 text-amber-500" />,
    position: "center",
  },
  {
    id: "edit",
    title: "Step 4 — Drag, Resize & Restyle",
    description:
      "Drag charts anywhere. Resize from any corner. Click a chart to open its settings — change type, color, and data fields. Use the Theme panel to restyle the whole dashboard.",
    icon: <Palette className="w-6 h-6 text-rose-500" />,
    position: "center",
  },
  {
    id: "export",
    title: "Step 5 — Export & Share",
    description:
      "Export as PNG or PDF. Generate a public share link or an iframe embed code. Schedule weekly email reports.",
    icon: <Download className="w-6 h-6 text-emerald-500" />,
    position: "center",
  },
  {
    id: "done",
    title: "You're ready! 🎉",
    description:
      "Use the sidebar to add follow-up queries and append more charts. The quality badge (top-right) shows Gemini's data health score.",
    icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
    position: "center",
  },
];

const STORAGE_KEY = "analyticsvisualai_tour_done";

interface OnboardingTourProps {
  /** If true, forces tour to show even if already completed (e.g. triggered from help button) */
  forceShow?: boolean;
  onClose?: () => void;
}

export function OnboardingTour({ forceShow = false, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceShow) { setVisible(true); return; }
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setVisible(true);
  }, [forceShow]);

  function next() {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      close();
    }
  }

  function close() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onClose?.();
  }

  const current = TOUR_STEPS[step];
  const progress = ((step + 1) / TOUR_STEPS.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
            onClick={close}
          />

          {/* Card */}
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -10 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none px-4"
          >
            <div className="pointer-events-auto bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-gray-100" ref={progressRef}>
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-violet-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                  {current.icon}
                </div>

                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{current.title}</h2>
                  <button
                    onClick={close}
                    className="shrink-0 p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-gray-500 leading-relaxed mb-5">{current.description}</p>

                {/* Step dots */}
                <div className="flex items-center gap-1.5 mb-5">
                  {TOUR_STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`transition-all rounded-full ${
                        i === step
                          ? "w-5 h-2 bg-blue-500"
                          : i < step
                          ? "w-2 h-2 bg-blue-300"
                          : "w-2 h-2 bg-gray-200 hover:bg-gray-300"
                      }`}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={close}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Skip tour
                  </button>
                  <button
                    onClick={next}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                  >
                    {step < TOUR_STEPS.length - 1 ? (
                      <>Next <ChevronRight className="w-4 h-4" /></>
                    ) : (
                      <>Let&apos;s go! <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Small help button that re-opens the tour */
export function TourHelpButton() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="w-6 h-6 rounded-full bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-600 text-xs font-bold flex items-center justify-center transition-colors"
        title="Show onboarding tour"
      >
        ?
      </button>
      {show && <OnboardingTour forceShow onClose={() => setShow(false)} />}
    </>
  );
}
