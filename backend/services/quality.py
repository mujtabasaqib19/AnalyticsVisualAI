"""
Quality service — 100% Gemini-driven.
Gemini is the sole quality agent. Claude handles dashboard generation only.
No deterministic fallback scores — transparent unavailability on failure.
"""
import os
import json
import re
import logging
import httpx
import config

logger = logging.getLogger(__name__)


async def validate_with_gemini(schema: dict, sample_rows: list[dict]) -> dict:
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    if not GEMINI_KEY:
        return {
            "quality_score": None,
            "issues": [],
            "warnings": ["GEMINI_API_KEY not configured — quality validation skipped."],
            "recommendation": "Set GEMINI_API_KEY in your .env to enable Gemini-driven data quality analysis.",
            "llm_driven": False,
        }

    prompt = f"""You are an expert data quality analyst. Assess the dataset described below and return a structured quality report covering completeness, consistency, validity, and visualization readiness.

SCHEMA:
{json.dumps(schema, indent=2)}

SAMPLE ROWS (first 10):
{json.dumps(sample_rows[:10], indent=2)}

━━━ EVALUATION CRITERIA ━━━

CRITICAL ISSUES (each deducts 15–20 points from score):
- Any column with > 40% null/missing values
- Numeric columns that contain mostly non-numeric strings (type mismatch)
- Zero usable rows or zero columns after parsing
- All rows appear identical across every column (no variance = no analytical value)
- Primary entity or ID column is entirely null
- Dataset has fewer than 5 rows (too sparse for any visualization)

WARNINGS (each deducts 5–10 points):
- Columns with 20–40% null values
- Mixed date formats in a single date column (e.g. "2024-01-01" and "01/01/2024" coexisting)
- Numeric columns with extreme outliers (values > 5× the interquartile range)
- Column names that are auto-generated or meaningless (e.g. "Unnamed: 0", "col_1", "Column3")
- Columns where every value is identical (zero variance = no analytical value)
- Dataset has fewer than 20 rows (very limited chart utility)
- Date column present but all dates are the same (no time dimension possible)
- Duplicate rows detected (inflates aggregation metrics)
- Numeric values that appear to be stored as strings (e.g. "1,234.56" with commas)
- Very high cardinality string columns that cannot be used as dimensions (unique_count > 90% of rows)

VISUALIZATION READINESS (informational, deduct 0–5 points each):
- No numeric columns → only count-based charts possible; mention this
- No categorical columns → no breakdown charts possible; mention this
- No date columns → no trend/time-series charts possible; mention this
- Only 1 column total → extremely limited dashboard possible
- All columns are IDs → no analytical value at all

━━━ SCORING ━━━

Start at 100. Apply deductions. Clamp to [0, 100].
  80–100 → Clean data, ready for full visualization
  50–79  → Usable with caveats; note specific issues
  0–49   → Significant problems; charts may be misleading

━━━ SPECIFICITY REQUIREMENT ━━━

For every issue and warning: name the EXACT column and describe the PRECISE problem and its analytical impact.

BAD:  "Some columns have nulls"
GOOD: "Column 'Profit' has 34% missing values — summing this field will undercount actual total profit by approximately one-third"

BAD:  "There are outliers"
GOOD: "Column 'Sales' has a max value of 22,638 vs a 75th percentile of 209 — this extreme outlier will dominate bar charts and compress all other bars to near-zero"

Return ONLY valid JSON with no other text:
{{
  "quality_score": <integer 0-100>,
  "issues": ["specific critical issue with exact column name and analytical impact"],
  "warnings": ["specific warning with exact column name and analytical impact"],
  "recommendation": "one actionable sentence: what to clean, what to watch out for, or how to interpret results given these issues"
}}"""

    try:
        async with httpx.AsyncClient(timeout=config.GEMINI_VALIDATE_TIMEOUT) as client:
            resp = await client.post(
                f"{config.GEMINI_ENDPOINT}?key={GEMINI_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]

            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                result = json.loads(json_match.group())
                result["llm_driven"] = True
                return result
    except Exception as e:
        error_detail = str(e)
        logger.error(f"Gemini quality validation error: {error_detail}")
        return {
            "quality_score": None,
            "issues": [],
            "warnings": [f"Gemini validation error: {error_detail}"],
            "recommendation": "Quality check could not be completed. Review your data manually before relying on dashboard results.",
            "llm_driven": False,
        }
