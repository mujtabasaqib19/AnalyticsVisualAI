import type { DashboardSpec } from "@/store/dashboardStore";
import type { GeminiValidationResult } from "@/lib/gemini";

export interface FilePayload {
  fileName: string;
  schema:   object;
  rows:     object[];
}

export interface ClaudeGenerateRequest {
  files:         FilePayload[];
  userQuery:     string;
  dashboardType: string;
}

export interface GenerateResponse {
  spec:    DashboardSpec;
  quality: GeminiValidationResult | null;
  mergedData?: any;
}

export async function generateDashboard(req: ClaudeGenerateRequest): Promise<GenerateResponse> {
  const response = await fetch("/api/generate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(req),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `API error ${response.status}`);
  }

  return response.json();
}
