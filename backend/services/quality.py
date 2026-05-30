import os
import json
import re
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)



GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent"


def _rule_based_quality(schema: dict, sample_rows: list[dict]) -> dict:
    """Fallback rule-based quality check when Gemini is unavailable."""
    issues = []
    warnings = []
    score = 100

    columns = schema.get("columns", [])
    row_count = schema.get("row_count", 0)

    for col in columns:
        null_pct = col.get("null_pct", 0) or (col.get("null_count", 0) / max(row_count, 1) * 100)
        if null_pct > 40:
            issues.append(f"Column '{col['name']}' has {null_pct:.0f}% missing values")
            score -= 15
        elif null_pct > 20:
            warnings.append(f"Column '{col['name']}' has {null_pct:.0f}% missing values")
            score -= 5

        if col.get("unique_count", 0) == 1:
            warnings.append(f"Column '{col['name']}' has only one unique value")
            score -= 3

    if row_count < 10:
        warnings.append(f"Dataset has only {row_count} rows — limited insight potential")
        score -= 10

    if len(columns) == 0:
        issues.append("No columns detected in dataset")
        score = 0

    score = max(0, min(100, score))
    recommendation = (
        "Data looks good — dashboard generation can proceed." if score >= 80
        else "Review flagged columns before interpreting dashboard results."
        if score >= 50
        else "Significant data quality issues detected. Clean your dataset before proceeding."
    )

    return {"quality_score": score, "issues": issues, "warnings": warnings, "recommendation": recommendation}


async def validate_with_gemini(schema: dict, sample_rows: list[dict]) -> dict:
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    if not GEMINI_KEY:
        return _rule_based_quality(schema, sample_rows)

    prompt = f"""Analyze this dataset for data quality issues.
Schema: {json.dumps(schema, indent=2)}
Sample Data (first 10 rows): {json.dumps(sample_rows[:10], indent=2)}

Check for: null/missing values (flag columns > 20% null), outliers, data type mismatches, duplicate-looking records, date format inconsistencies, and column names that are meaningless or garbled.

Return ONLY valid JSON in this exact format:
{{
  "quality_score": <integer 0-100>,
  "issues": ["critical issue 1", "critical issue 2"],
  "warnings": ["warning 1", "warning 2"],
  "recommendation": "one sentence recommendation"
}}"""

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={GEMINI_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]

            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                return json.loads(json_match.group())
    except Exception as e:
        logger.error(f"Gemini validation error: {e}")

    # Fallback to rule-based
    return _rule_based_quality(schema, sample_rows)
