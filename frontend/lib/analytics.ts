/**
 * Usage analytics — lightweight, localStorage-backed.
 * Tracks which chart types and queries are most used.
 * No external service, no PII.
 */

export interface AnalyticsEvent {
  type: "chart_view" | "chart_export" | "dashboard_generated" | "follow_up" | "feedback";
  payload: Record<string, unknown>;
  ts: number;
}

const KEY = "analyticsvisualai_usage";
const MAX_EVENTS = 500;

function readEvents(): AnalyticsEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeEvents(events: AnalyticsEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // localStorage full — silently ignore
  }
}

export function trackEvent(type: AnalyticsEvent["type"], payload: Record<string, unknown> = {}) {
  const events = readEvents();
  events.push({ type, payload, ts: Date.now() });
  writeEvents(events);
}

export interface UsageSummary {
  totalDashboards: number;
  totalFollowUps: number;
  chartTypeCounts: Record<string, number>;
  topQuery: string;
  feedbackPositive: number;
  feedbackNegative: number;
}

export function getUsageSummary(): UsageSummary {
  const events = readEvents();
  const chartCounts: Record<string, number> = {};
  let dashboards = 0;
  let followUps = 0;
  let positive = 0;
  let negative = 0;
  const queries: string[] = [];

  for (const e of events) {
    if (e.type === "dashboard_generated") {
      dashboards++;
      if (e.payload.query) queries.push(e.payload.query as string);
    }
    if (e.type === "follow_up") followUps++;
    if (e.type === "chart_view") {
      const ct = (e.payload.chartType as string) ?? "unknown";
      chartCounts[ct] = (chartCounts[ct] ?? 0) + 1;
    }
    if (e.type === "feedback") {
      if (e.payload.rating === "positive") positive++;
      else negative++;
    }
  }

  const topQuery = queries[queries.length - 1] ?? "";

  return {
    totalDashboards: dashboards,
    totalFollowUps: followUps,
    chartTypeCounts: chartCounts,
    topQuery,
    feedbackPositive: positive,
    feedbackNegative: negative,
  };
}
