"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart3,
  Upload,
  Sparkles,
  Shield,
  Zap,
  ArrowRight,
  Database,
  TrendingUp,
  PieChart,
  Activity,
  CheckCircle,
} from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Upload Any Data",
    description: "CSV, Excel, JSON — drop your file and our parser handles schema detection automatically.",
    accent: "bg-blue-50 text-blue-600 border-blue-100",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    icon: Sparkles,
    title: "Plain-English Queries",
    description: '"Show me monthly revenue by region" — Claude turns words into complete, interactive dashboards.',
    accent: "bg-violet-50 text-violet-600 border-violet-100",
    iconBg: "bg-violet-100 text-violet-600",
  },
  {
    icon: Shield,
    title: "Gemini Quality Guard",
    description: "A parallel AI supervisor catches nulls, outliers, and type issues before they corrupt your charts.",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: Zap,
    title: "Editable Dashboards",
    description: "Drag, resize, recolor every chart. Export to PNG or embed anywhere — zero configuration.",
    accent: "bg-amber-50 text-amber-700 border-amber-100",
    iconBg: "bg-amber-100 text-amber-600",
  },
];

const stats = [
  { value: "~30s", label: "Dashboard generation" },
  { value: "10+", label: "Chart types" },
  { value: "Claude + Gemini", label: "Dual-AI pipeline" },
  { value: "0 SQL", label: "No code required" },
];

const benefits = [
  "No Power BI license needed",
  "Works on any dataset",
  "Drag-and-drop editing",
  "Export PNG, PDF, embed code",
  "Gemini data quality scoring",
  "Follow-up AI queries",
];

const chartIcons = [BarChart3, TrendingUp, PieChart, Activity];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* ── Nav ───────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-gray-900">
              Analytics<span className="gradient-text">Visual</span>AI
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/upload"
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/upload"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all glow-primary shadow-sm"
            >
              Try Free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium mb-8">
            <Sparkles className="w-3 h-3" />
            Claude + Gemini A2A Pipeline — Full MVP (Phases 1–5)
          </div>

          <h1 className="text-5xl md:text-[68px] font-normal leading-[1.05] tracking-tight text-gray-900 mb-6">
            Turn raw data into{" "}
            <span className="gradient-text">beautiful dashboards</span>{" "}
            in seconds
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Upload a CSV. Describe what you want in plain English. Get a fully
            interactive, exportable dashboard — no Power BI, no Tableau, no manual work.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/upload"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-[15px] transition-all glow-primary shadow-md"
            >
              Upload Your Data
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:border-blue-200 hover:bg-blue-50 text-gray-700 rounded-xl font-medium text-[15px] transition-all shadow-sm"
            >
              <BarChart3 className="w-4 h-4 text-blue-500" />
              View Demo Dashboard
            </Link>
          </div>
        </motion.div>

        {/* Floating chart icons */}
        <motion.div
          className="mt-16 grid grid-cols-4 gap-4 max-w-xs mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {chartIcons.map((Icon, i) => (
            <motion.div
              key={i}
              className="aspect-square bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, delay: i * 0.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon className="w-7 h-7 text-blue-400" />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Stats strip ───────────────────────────────── */}
      <section className="border-y border-gray-100 bg-white/60">
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              className="text-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              <div className="text-2xl font-semibold text-gray-900 mb-1">{s.value}</div>
              <div className="text-sm text-gray-400">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-4xl font-normal text-gray-900 mb-3">How it works</h2>
          <p className="text-gray-400 text-lg font-light">Two AI agents, one seamless workflow</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-blue-100 hover:shadow-md transition-all group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.iconBg}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 text-[17px] mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Benefits checklist ────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-white border border-gray-100 rounded-3xl p-10 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-4xl font-normal text-gray-900 mb-4">
                Everything you need,<br />nothing you don't
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8 font-light">
                Replace a $70/month BI tool with an AI that understands your data in seconds.
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-[15px] transition-all glow-primary shadow-md"
              >
                Start Now — It&apos;s Free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-gray-600 text-[15px]">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-blue-600 p-12 text-center shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 30% 40%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
          />
          <Database className="w-10 h-10 text-blue-200 mx-auto mb-5 relative" />
          <h2 className="text-4xl font-normal text-white mb-3 relative">Ready to replace your BI tools?</h2>
          <p className="text-blue-200 mb-8 max-w-md mx-auto font-light text-lg relative">
            Upload any dataset and let Claude build your first dashboard in under 30 seconds.
          </p>
          <Link
            href="/upload"
            className="relative inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-blue-50 text-blue-700 rounded-xl font-semibold text-[15px] transition-all shadow-md"
          >
            Upload Your First Dataset
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        AnalyticsVisualAI v1.0 — Built with Claude + Gemini A2A
      </footer>
    </div>
  );
}
