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
import os, json, logging, httpx
import config

logger = logging.getLogger(__name__)
router = APIRouter()


class ReportRequest(BaseModel):
    dashboard_spec: dict          # full DashboardSpec JSON
    schema: dict                  # DataSchema JSON
    sample_rows: list[dict]
    quality: Optional[dict] = None   # ValidationResult JSON


@router.post("/report")
async def generate_report(request: ReportRequest):
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key or gemini_key.startswith("your_"):
        raise HTTPException(
            503,
            "Report generation requires a Gemini API key. "
            "Get your free key at aistudio.google.com/app/apikey and add GEMINI_API_KEY to .env"
        )

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

    prompt = f"""You are a senior data analyst writing a professional analytical report. Every statement must be grounded in the actual data provided — no generic filler, no assumptions beyond what the schema and sample rows support.

━━━ DATASET CONTEXT ━━━
TITLE:         {spec.get('dashboard_title', 'Dataset Analysis')}
TOTAL ROWS:    {schema.get('row_count', 'unknown')}
ALL COLUMNS:   {', '.join(c['name'] for c in schema.get('columns', []))}
NUMERIC COLS:  {', '.join(c['name'] for c in schema.get('columns', []) if c.get('type') == 'numeric') or 'none — count-based analysis only'}
CATEGORICAL:   {', '.join(c['name'] for c in schema.get('columns', []) if c.get('type') == 'string') or 'none'}
DATE COLS:     {', '.join(c['name'] for c in schema.get('columns', []) if c.get('type') == 'date') or 'none — no time-series analysis possible'}

CHARTS GENERATED:
{chart_summary}

AI INSIGHTS FROM CLAUDE:
{json.dumps(spec.get('suggested_insights', []), indent=2)}

DATA QUALITY:
- Score:            {quality.get('quality_score', 'N/A')}/100
- Critical issues:  {json.dumps(quality.get('issues', []))}
- Warnings:         {json.dumps(quality.get('warnings', []))}
- Assessment:       {quality.get('recommendation', 'N/A')}

SAMPLE DATA (first 5 rows):
{json.dumps(request.sample_rows[:5], indent=2)}

━━━ WRITING INSTRUCTIONS ━━━

Write in markdown. Be analytical and specific. Reference actual column names, values from sample rows, and chart titles throughout. If the dataset has no numeric columns, focus on frequency and distribution analysis. If there are no date columns, omit time-trend commentary. Adapt every section to what this specific dataset actually contains.

---

## Executive Summary
What is this dataset? What entity does one row represent? What is its scale ({schema.get('row_count', '?')} rows)? What is the single most important finding a decision-maker should act on? (3–4 sentences. Use specific numbers visible in sample data or schema stats.)

## Data Reliability
Quality score: {quality.get('quality_score', 'N/A')}/100. What does this score mean for the reliability of the charts? Address each critical issue and warning by name — explain its analytical impact, not just its existence. If quality is high (80+), confirm what is clean and why the data is trustworthy. (Do not simply restate the issues list.)

## What the Data Shows
For each chart generated, write one focused sentence describing what pattern, comparison, or trend it reveals and what analytical question it answers. Name each chart by its exact title.

## Key Analytical Findings
5 numbered findings. Each must:
- Name a specific column or metric
- State an observation with a concrete value, percentage, or rank
- Explain the business or analytical significance of that observation

## Anomalies & Risks
2–3 specific points about what looks unusual, inconsistent, or risky in this dataset. What should an analyst validate before acting on these charts?

## Recommended Actions
3–5 concrete, specific actions that directly follow from the data. Each action must be precise enough that someone knows exactly what to do next.

## Conclusion
The overall analytical story of this dataset in 2–3 sentences. What is the data trying to tell us?

Write only the report content. No preamble, no "Here is your report" opener."""

    try:
        async with httpx.AsyncClient(timeout=config.GEMINI_REPORT_TIMEOUT) as client:
            resp = await client.post(
                f"{config.GEMINI_ENDPOINT}?key={gemini_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return {"report": text, "title": spec.get("dashboard_title", "Dashboard")}
    except Exception as e:
        logger.error(f"Gemini report error: {e}")
        raise HTTPException(500, "Report generation failed. Please try again.")
