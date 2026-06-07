// Gemini-driven types — validation is handled entirely by the backend (/validate).
// The frontend never calls Gemini directly; all Gemini work happens server-side.

export interface GeminiValidationResult {
  quality_score: number | null;  // null when Gemini is unavailable
  issues: string[];
  warnings: string[];
  recommendation: string;
  llm_driven?: boolean;
}
