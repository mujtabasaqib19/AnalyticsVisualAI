"""
POST /report

Calls Gemini to write a full narrative data analysis report based on:
- The dashboard specification (charts, insights)
- The data schema (column profiles)
- The quality validation result
- Sample rows

Returns plain text markdown that the frontend converts to a styled PDF.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os, json, re, logging, httpx

logger = logging.getLogger(__name__)
router = APIRouter()

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent"


class ReportRequest(BaseModel):
    dashboard_spec: dict          # full DashboardSpec JSON
    schema: dict                  # DataSchema JSON
    sample_rows: list[dict]
    quality: Optional[dict] = None   # ValidationResult JSON


@router.post("/report")
async def generate_report(request: ReportRequest):
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    if not GEMINI_KEY:
        raise HTTPException(500, "GEMINI_API_KEY not configured")

    spec   = request.dashboard_spec
    schema = request.schema
    quality = request.quality or {}
    charts = spec.get("charts", [])

    chart_summary = "\n".join(
        f"- {c.get('title', 'Chart')} ({c.get('type', '?')}): "
        f"x={c.get('x_field', '—')}, y={c.get('y_field', c.get('value_field', '—'))}, "
        f"aggregation={c.get('aggregation', 'sum')}"
        for c in charts
    )

    prompt = f"""You are a senior data analyst. Write a professional, executive-ready data analysis report based on the information below.

DASHBOARD TITLE: {spec.get('dashboard_title', 'Dashboard')}

DATA SCHEMA SUMMARY:
- Total rows: {schema.get('row_count', 'unknown')}
- Columns: {', '.join(c['name'] for c in schema.get('columns', []))}
- Numeric columns: {', '.join(c['name'] for c in schema.get('columns', []) if c.get('type') == 'numeric')}
- Categorical columns: {', '.join(c['name'] for c in schema.get('columns', []) if c.get('type') == 'string')}

CHARTS IN DASHBOARD:
{chart_summary}

AI SUGGESTED INSIGHTS: {json.dumps(spec.get('suggested_insights', []))}

DATA QUALITY ASSESSMENT:
- Quality Score: {quality.get('quality_score', 'N/A')}/100
- Issues: {json.dumps(quality.get('issues', []))}
- Warnings: {json.dumps(quality.get('warnings', []))}
- Recommendation: {quality.get('recommendation', 'N/A')}

SAMPLE DATA (first 5 rows):
{json.dumps(request.sample_rows[:5], indent=2)}

---

Write the report in this EXACT structure. Use markdown headings (##, ###). Be specific, professional, and data-driven. Avoid generic filler — every sentence should reference the actual columns, metrics, or findings above.

## Executive Summary
(3-4 sentences: what this dataset is, key scale, primary finding)

## Data Quality Assessment
(Reference the quality score, call out specific issues and warnings, note what was clean)

## Dataset Overview
(Describe the dataset structure — row count, key dimensions, key metrics)

## Key Findings & Insights
(4-6 numbered bullet points, each referencing a specific column, metric, or chart from the dashboard)

## Chart-by-Chart Analysis
(For each chart listed above, write 1-2 sentences explaining what it shows and what to look for)

## Recommendations
(3-5 actionable recommendations based on the data quality and insights above)

## Conclusion
(2-3 sentences wrapping up)

Write only the report. No preamble, no "here is your report", just the markdown content."""

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={GEMINI_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return {"report": text, "title": spec.get("dashboard_title", "Dashboard")}
    except Exception as e:
        logger.error(f"Gemini report error: {e}")
        raise HTTPException(500, f"Report generation failed: {str(e)}")
