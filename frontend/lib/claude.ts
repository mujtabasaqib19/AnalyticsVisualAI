import type { DashboardSpec } from "@/store/dashboardStore";

export interface ClaudeGenerateRequest {
  schema: object;
  userQuery: string;
  dashboardType: string;  // Any domain — "auto" = Claude self-detects from schema
  sampleRows?: object[];
}

export async function generateDashboard(req: ClaudeGenerateRequest): Promise<DashboardSpec> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error ${response.status}`);
  }

  return response.json();
}
