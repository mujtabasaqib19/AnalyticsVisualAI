"use client";

import { useEffect, useState } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { QualityBadge } from "@/components/dashboard/QualityBadge";
import { BarChart3, AlertTriangle, Loader2, Upload } from "lucide-react";
import Link from "next/link";

interface SharePayload {
  spec: ReturnType<typeof useDashboardStore.getState>["dashboardSpec"];
  rows: Record<string, unknown>[];
}

export default function SharePage({
  searchParams,
}: {
  searchParams: { d?: string };
}) {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = searchParams.d;
    if (!id) {
      setError("No share token found in URL.");
      setLoading(false);
      return;
    }

    fetch(`/api/share?id=${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invalid or expired share link.");
        return r.json();
      })
      .then((data) => setPayload(data))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [searchParams.d]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-gray-900">
            Analytics<span className="text-blue-600">Visual</span>AI
          </span>
          <span className="ml-2 text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
            Shared View
          </span>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-all"
        >
          <Upload className="w-3 h-3" />
          Create Your Own
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-gray-400 text-sm">Loading shared dashboard…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <AlertTriangle className="w-10 h-10 text-red-300" />
            <p className="text-red-500 font-medium">{error}</p>
            <Link
              href="/"
              className="mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Go Home
            </Link>
          </div>
        )}

        {payload?.spec && (
          <>
            {/* Dashboard header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{payload.spec.dashboard_title}</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  {payload.rows.length.toLocaleString()} data rows · Read-only shared view
                </p>
              </div>
              {payload.spec.suggested_insights && payload.spec.suggested_insights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {payload.spec.suggested_insights.slice(0, 2).map((insight, i) => (
                    <p
                      key={i}
                      className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 max-w-xs"
                    >
                      ✨ {insight}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {payload.spec.charts.map((chart) => (
                <div
                  key={chart.id}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
                  style={{ height: chart.position.h * 56 + Math.max(0, chart.position.h - 1) * 8 }}
                >
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
                    <span className="text-sm font-medium text-gray-700 truncate">{chart.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200 shrink-0">
                      {chart.type}
                    </span>
                  </div>
                  <div className="p-3 h-[calc(100%-44px)]">
                    <ChartRenderer
                      spec={chart}
                      data={payload.rows as Record<string, unknown>[]}
                      isSelected={false}
                      theme={null}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-10 text-center">
              <div className="inline-flex flex-col sm:flex-row items-center gap-3 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div>
                  <p className="font-semibold text-gray-800">Want to build dashboards like this?</p>
                  <p className="text-sm text-gray-400 mt-0.5">Upload your data and ask Claude in plain English.</p>
                </div>
                <Link
                  href="/upload"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm whitespace-nowrap"
                >
                  Try for Free →
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
