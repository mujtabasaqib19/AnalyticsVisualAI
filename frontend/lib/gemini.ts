export interface GeminiValidationResult {
  quality_score: number;
  issues: string[];
  warnings: string[];
  recommendation: string;
}

export async function validateData(schema: object, sampleRows: object[]): Promise<GeminiValidationResult> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema, sample_rows: sampleRows }),
  });

  if (!response.ok) {
    return { quality_score: 75, issues: [], warnings: ["Validation service unavailable"], recommendation: "" };
  }

  return response.json();
}
