import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { QUALITY_GOOD, QUALITY_MODERATE } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function getQualityColor(score: number | null) {
  if (score === null)            return { text: "text-gray-500",    bg: "bg-gray-100",   border: "border-gray-200",    label: "Not Checked" };
  if (score >= QUALITY_GOOD)     return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "High Quality" };
  if (score >= QUALITY_MODERATE) return { text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   label: "Moderate Issues" };
  return                                { text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     label: "Poor Quality" };
}

export const CHART_COLORS = [
  "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#84cc16", "#ec4899",
];
