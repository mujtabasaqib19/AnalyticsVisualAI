"""
EDA Engine — fully LLM-driven analysis service.
Gemini is the PRIMARY EDA agent. Claude is the BACKUP if Gemini is unavailable.
Python executes the agent's decisions mechanically via pandas — no deterministic rules.

Agent roles:
  Gemini  → EDA cleaning plan (primary)
  Claude  → EDA cleaning plan (backup, same prompt)
  Pandas  → mechanical execution of whichever agent's plan
"""
from __future__ import annotations

import json
import math
import os
import re
import logging
from typing import Any

import anthropic
import httpx
import numpy as np
import pandas as pd
import config

logger = logging.getLogger(__name__)

EDA_MAX_COLUMNS = 40
EDA_MAX_ROWS    = 100_000


# ─────────────────────────────────────────────────────────────────────────────
# Shared prompt builder (used by both Gemini and Claude agents)
# ─────────────────────────────────────────────────────────────────────────────

def _build_eda_prompt(col_stats: list[dict], description: str, sample_rows: list[dict]) -> str:
    return f"""You are an expert data scientist performing Exploratory Data Analysis (EDA).
Analyse the dataset described below and return a structured cleaning plan as JSON.

DATASET DESCRIPTION (provided by user):
{description or "No description provided."}

COLUMN STATISTICS (includes distribution metrics for outlier reasoning):
{json.dumps(col_stats, indent=2)}

SAMPLE ROWS (first 20):
{json.dumps(sample_rows, indent=2)}

Your task: produce a JSON cleaning plan with the following structure.
Return ONLY valid JSON — no markdown fences, no other text.

{{
  "columns": [
    {{
      "name": "<column name>",
      "classification": "<one of: id_column | date | binary | numeric_continuous | numeric_discrete | high_cardinality_numeric | categorical>",
      "drop": <true if >40% nulls OR the column has zero analytical value, otherwise false>,
      "drop_reason": "<brief reason if drop=true, else null>",
      "null_strategy": "<one of: median | mean | mode | constant | none>",
      "null_constant": "<value to fill if strategy=constant, else null>",
      "coerce_type": "<one of: numeric | date | none>",
      "binary_labels": {{"0": "<label for 0>", "1": "<label for 1>"}} or null,
      "range_buckets": {{"<label>": "<lo-hi range string>"}} or null,
      "recommended_chart": "<one of: bar | donut | line | scatter | area | none>",
      "outlier_flag": <true if this numeric column contains suspicious outliers, false otherwise>,
      "outlier_lower_bound": <numeric lower bound below which values are outliers, or null>,
      "outlier_upper_bound": <numeric upper bound above which values are outliers, or null>,
      "outlier_reasoning": "<specific reason citing actual stats if outlier_flag=true, else null>",
      "reasoning": "<one concise sentence explaining your decisions>"
    }}
  ],
  "insights": [
    "<actionable insight string 1>",
    "<actionable insight string 2>",
    "... up to 6 insights total"
  ]
}}

RULES:
- classification MUST be one of the exact strings listed above.
- binary_labels: only set for binary columns; labels must reflect the dataset context (use description).
- range_buckets: only set for high_cardinality_numeric columns; use 3-5 meaningful labels with ranges like "Low: 0-33".
- null_strategy "none" means leave nulls as-is (e.g. for id_column or date).
- Do NOT drop columns just because they have nulls under 40% — impute instead.
- outlier_flag: only set true for numeric columns (numeric_continuous, numeric_discrete, high_cardinality_numeric).
  Use mean, std, p25, p75 to reason. Flag if max >> p75 + 1.5*(p75-p25) or min << p25 - 1.5*(p25-p75).
  Use domain knowledge from the description to judge plausibility.
- outlier_lower_bound / outlier_upper_bound: REQUIRED when outlier_flag=true; provide the numeric bounds you used.
- Insights must be specific, data-driven, and reference actual column names and values.
- Every column in the statistics list MUST appear in the output, in the same order."""


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point (async — requires at least one LLM key)
# ─────────────────────────────────────────────────────────────────────────────

async def run_eda(rows: list[dict], schema: list[dict], description: str) -> dict:
    if not rows:
        return _empty_result()

    if len(rows) > EDA_MAX_ROWS:
        raise ValueError(
            f"Dataset too large for EDA: {len(rows):,} rows (limit {EDA_MAX_ROWS:,}). "
            "Use a filtered or sampled subset."
        )
    if len(schema) > EDA_MAX_COLUMNS:
        raise ValueError(
            f"Dataset too wide for EDA: {len(schema)} columns (limit {EDA_MAX_COLUMNS}). "
            "Select a subset of columns before running EDA."
        )

    df = pd.DataFrame(rows)
    original_rows = len(df)

    # ── 1. Duplicate removal (always safe, no decisions needed) ──────────────
    df = df.drop_duplicates()
    duplicates_removed = original_rows - len(df)

    # ── 2. Build column lookup ────────────────────────────────────────────────
    schema_map: dict[str, dict] = {c["name"]: c for c in schema}
    col_names = [c for c in df.columns if c in schema_map]

    # ── 3. Compute per-column distribution stats for the LLM ─────────────────
    col_stats = _compute_col_stats(df, col_names, schema_map)

    # ── 4. Ask primary agent (Gemini) — failover to backup agent (Claude) ────
    plan = await _get_llm_cleaning_plan(col_stats, description, rows[:20])

    # ── 5. Execute the plan mechanically ─────────────────────────────────────
    result = _execute_plan(df, col_names, schema_map, plan, duplicates_removed, original_rows)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — column statistics (measurement only, no decisions)
# ─────────────────────────────────────────────────────────────────────────────

def _compute_col_stats(df: pd.DataFrame,
                       col_names: list[str],
                       schema_map: dict[str, dict]) -> list[dict]:
    stats = []
    for col in col_names:
        sch = schema_map[col]
        series = df[col]
        null_count = int(series.isna().sum())
        total = len(series)
        non_null = series.dropna()
        unique_count = int(series.nunique())

        sample_vals = [str(v) for v in non_null.head(8).tolist()]

        num_min = num_max = num_mean = num_std = num_p25 = num_p75 = None
        try:
            nums = pd.to_numeric(non_null, errors="coerce").dropna()
            if len(nums) > 0:
                num_min  = _safe_scalar(nums.min())
                num_max  = _safe_scalar(nums.max())
                num_mean = _safe_scalar(nums.mean())
                num_std  = _safe_scalar(nums.std())
                num_p25  = _safe_scalar(nums.quantile(0.25))
                num_p75  = _safe_scalar(nums.quantile(0.75))
        except Exception:
            pass

        stats.append({
            "name": col,
            "schema_type": sch.get("type", "string"),
            "null_count": null_count,
            "null_pct": round(null_count / total * 100, 1) if total > 0 else 0,
            "unique_count": unique_count,
            "total_rows": total,
            "sample_values": sample_vals,
            "numeric_min": num_min,
            "numeric_max": num_max,
            "numeric_mean": num_mean,
            "numeric_std": num_std,
            "numeric_p25": num_p25,
            "numeric_p75": num_p75,
        })
    return stats


# ─────────────────────────────────────────────────────────────────────────────
# Step 4a — Primary agent: Gemini
# ─────────────────────────────────────────────────────────────────────────────

async def _get_llm_cleaning_plan(col_stats: list[dict],
                                  description: str,
                                  sample_rows: list[dict]) -> dict:
    """
    Ask Gemini (primary) for the cleaning plan.
    On any failure, route to Claude (backup) — never fall back to deterministic rules.
    """
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    if not GEMINI_KEY:
        logger.info("GEMINI_API_KEY not set — routing EDA plan to Claude (backup agent).")
        return await _get_claude_cleaning_plan(col_stats, description, sample_rows)

    prompt = _build_eda_prompt(col_stats, description, sample_rows)

    try:
        async with httpx.AsyncClient(timeout=config.GEMINI_EDA_TIMEOUT) as client:
            resp = await client.post(
                f"{config.GEMINI_ENDPOINT}?key={GEMINI_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]

            text = re.sub(r"```(?:json)?", "", text).strip()
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                plan = json.loads(json_match.group())
                if "columns" in plan and "insights" in plan:
                    logger.info("EDA plan produced by Gemini (primary agent).")
                    return plan
    except Exception as e:
        logger.warning(f"Gemini EDA plan failed: {e} — routing to Claude (backup agent).")

    return await _get_claude_cleaning_plan(col_stats, description, sample_rows)


# ─────────────────────────────────────────────────────────────────────────────
# Step 4b — Backup agent: Claude
# ─────────────────────────────────────────────────────────────────────────────

async def _get_claude_cleaning_plan(col_stats: list[dict],
                                     description: str,
                                     sample_rows: list[dict]) -> dict:
    """
    Ask Claude for the cleaning plan — A2A failover when Gemini is unavailable.
    Same prompt, same schema. Raises if Claude is also unavailable — no deterministic fallback.
    """
    CLAUDE_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    if not CLAUDE_KEY or CLAUDE_KEY.startswith("your_"):
        raise ValueError(
            "EDA requires at least one LLM key. "
            "Set GEMINI_API_KEY (primary) or ANTHROPIC_API_KEY (backup) in your .env file."
        )

    prompt = _build_eda_prompt(col_stats, description, sample_rows)

    async_client = anthropic.AsyncAnthropic(api_key=CLAUDE_KEY)
    try:
        message = await async_client.messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=8192,   # Claude 3.5 supports up to 8192 output tokens. Do not set higher or API will reject it.
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text if message.content else ""
        text = re.sub(r"```(?:json)?", "", text).strip()
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                plan = json.loads(json_match.group())
                if "columns" in plan and "insights" in plan:
                    logger.info("EDA plan produced by Claude (backup agent).")
                    return plan
            except json.JSONDecodeError as je:
                logger.error(f"Claude returned invalid JSON (possibly truncated). Error: {je}\nRaw output length: {len(text)}")
                raise ValueError(f"Claude returned invalid/truncated JSON: {je}") from je
    except Exception as e:
        raise ValueError(f"Both Gemini and Claude failed to produce an EDA plan: {e}") from e

    raise ValueError("Claude returned an unparseable EDA plan — cannot proceed without LLM analysis.")


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — execute the plan mechanically with pandas
# ─────────────────────────────────────────────────────────────────────────────

def _execute_plan(df: pd.DataFrame,
                  col_names: list[str],
                  schema_map: dict[str, dict],
                  plan: dict,
                  duplicates_removed: int,
                  original_rows: int) -> dict:
    """
    Execute the LLM's cleaning plan step by step.
    All decisions come from `plan` — Python is the mechanical executor only.
    """
    plan_map: dict[str, dict] = {c["name"]: c for c in plan.get("columns", [])}

    type_fixes: dict[str, str] = {}
    nulls_imputed: dict[str, Any] = {}
    dropped_columns: list[str] = []
    binary_decodings: list[dict] = []
    range_groupings: list[dict] = []

    # ── Type coercion (LLM decided; Python executes without second-guessing) ──
    for col in col_names:
        entry = plan_map.get(col, {})
        coerce = entry.get("coerce_type", "none")
        if coerce == "numeric":
            converted = pd.to_numeric(df[col], errors="coerce")
            success_rate = converted.notna().sum() / max(len(df[col].dropna()), 1)
            df[col] = converted
            type_fixes[col] = f"string → numeric (LLM-directed; {success_rate:.0%} converted)"
        elif coerce == "date":
            try:
                # Try parsing with dayfirst=True (handles international DD/MM/YYYY)
                converted = pd.to_datetime(df[col], errors="coerce", dayfirst=True)
                success_rate = converted.notna().sum() / max(len(df[col].dropna()), 1)
                
                # If parsing was poor, try American format (MM/DD/YYYY)
                if success_rate < 0.5:
                    converted_alt = pd.to_datetime(df[col], errors="coerce", dayfirst=False)
                    alt_rate = converted_alt.notna().sum() / max(len(df[col].dropna()), 1)
                    if alt_rate > success_rate:
                        converted = converted_alt
                        success_rate = alt_rate
                
                # Format to standard ISO dates, replacing pandas NaT with actual None
                df[col] = converted.dt.strftime('%Y-%m-%d')
                df[col] = df[col].replace({'NaT': None, 'NaN': None, pd.NaT: None})
                
                type_fixes[col] = f"string → datetime (LLM-directed; {success_rate:.0%} converted)"
            except Exception:
                pass

    # ── Drop columns (per LLM decision) ──────────────────────────────────────
    for col in col_names:
        entry = plan_map.get(col, {})
        if entry.get("drop", False):
            dropped_columns.append(col)

    df = df.drop(columns=dropped_columns, errors="ignore")
    active_cols = [c for c in col_names if c not in dropped_columns]

    # ── Null imputation (LLM chose the strategy) ─────────────────────────────
    for col in active_cols:
        entry = plan_map.get(col, {})
        null_count = int(df[col].isna().sum())
        if null_count == 0:
            continue
        strategy = entry.get("null_strategy", "none")
        if strategy == "median":
            num = pd.to_numeric(df[col], errors="coerce")
            fill_val = num.median()
            if pd.isna(fill_val):
                fill_val = 0
            df[col] = df[col].fillna(fill_val)
            nulls_imputed[col] = {"method": "median", "value": _safe_scalar(fill_val)}
        elif strategy == "mean":
            num = pd.to_numeric(df[col], errors="coerce")
            fill_val = num.mean()
            if pd.isna(fill_val):
                fill_val = 0
            df[col] = df[col].fillna(fill_val)
            nulls_imputed[col] = {"method": "mean", "value": _safe_scalar(fill_val)}
        elif strategy == "mode":
            mode_vals = df[col].mode()
            fill_val = mode_vals.iloc[0] if len(mode_vals) > 0 else "Unknown"
            df[col] = df[col].fillna(fill_val)
            nulls_imputed[col] = {"method": "mode", "value": str(fill_val)}
        elif strategy == "constant":
            fill_val = entry.get("null_constant", "Unknown") or "Unknown"
            df[col] = df[col].fillna(fill_val)
            nulls_imputed[col] = {"method": "constant", "value": str(fill_val)}
        # "none" → leave as-is per LLM instruction

    # ── Binary decoding ───────────────────────────────────────────────────────
    for col in active_cols:
        entry = plan_map.get(col, {})
        if entry.get("classification") == "binary":
            labels = entry.get("binary_labels") or {"0": "No", "1": "Yes"}
            label_0 = labels.get("0", "No")
            label_1 = labels.get("1", "Yes")
            binary_decodings.append({"column": col, "0_label": label_0, "1_label": label_1})
            df[col] = df[col].map({
                0: label_0, 1: label_1, 0.0: label_0, 1.0: label_1,
                "0": label_0, "1": label_1, False: label_0, True: label_1,
            })

    # ── Range grouping ────────────────────────────────────────────────────────
    for col in active_cols:
        entry = plan_map.get(col, {})
        if entry.get("classification") == "high_cardinality_numeric":
            buckets = entry.get("range_buckets")
            if buckets:
                new_col_name = col + "_group"
                df[new_col_name] = df[col].apply(lambda v: _assign_bucket(v, buckets))
                range_groupings.append({
                    "original_column": col,
                    "new_column": new_col_name,
                    "buckets": buckets,
                })

    # ── Outlier detection (LLM decides; Python counts affected rows) ──────────
    outlier_report: list[dict] = []
    for col in active_cols:
        entry = plan_map.get(col, {})
        if entry.get("outlier_flag", False):
            lower = entry.get("outlier_lower_bound")
            upper = entry.get("outlier_upper_bound")
            series = pd.to_numeric(df[col], errors="coerce")
            if lower is not None and upper is not None:
                mask = (series < float(lower)) | (series > float(upper))
                count = int(mask.sum())
            else:
                count = int(series.notna().sum())
            if count > 0:
                outlier_report.append({
                    "column": col,
                    "outlier_count": count,
                    "action": "flagged",
                    "reasoning": entry.get("outlier_reasoning", ""),
                })

    # ── Build column profiles ─────────────────────────────────────────────────
    column_profiles: list[dict] = []
    excluded: list[str] = []
    viz_ready: list[str] = []

    for col in active_cols:
        entry = plan_map.get(col, {})
        cls = entry.get("classification", "categorical")
        sch = schema_map.get(col, {})

        if cls == "id_column":
            excluded.append(col)
            continue

        series = df[col]
        null_count = int(series.isna().sum())
        unique_count = int(series.nunique())

        mean_val = median_val = mode_val = None
        if cls in ("numeric_continuous", "numeric_discrete", "high_cardinality_numeric"):
            num = pd.to_numeric(series, errors="coerce")
            mean_val = _safe_scalar(num.mean())
            median_val = _safe_scalar(num.median())
            mode_s = num.mode()
            mode_val = _safe_scalar(mode_s.iloc[0]) if len(mode_s) > 0 else None

        mode_s = series.mode()
        cat_mode = str(mode_s.iloc[0]) if len(mode_s) > 0 and mean_val is None else None

        tx = []
        if col in nulls_imputed:
            tx.append(f"null imputation ({nulls_imputed[col]['method']})")
        if col in type_fixes:
            tx.append(type_fixes[col])
        if cls == "binary":
            bd = next((b for b in binary_decodings if b["column"] == col), None)
            if bd:
                tx.append(f"binary decoded → {bd['0_label']}/{bd['1_label']}")
        rg = next((r for r in range_groupings if r["original_column"] == col), None)
        if rg:
            tx.append(f"grouped → {rg['new_column']}")

        new_col = rg["new_column"] if rg else ""
        buckets = rg["buckets"] if rg else {}

        profile = {
            "name": col,
            "type": sch.get("type", "string"),
            "classification": cls,
            "mean": mean_val,
            "median": median_val,
            "mode": mode_val if mode_val is not None else cat_mode,
            "min": _safe_scalar(sch.get("min")),
            "max": _safe_scalar(sch.get("max")),
            "null_count": null_count,
            "null_pct": round((null_count / len(df) * 100) if len(df) > 0 else 0, 1),
            "unique_count": unique_count,
            "transformation_applied": "; ".join(tx) if tx else "none",
            "new_column_created": new_col,
            "range_buckets": buckets,
            "recommended_chart": entry.get("recommended_chart", "bar"),
            "has_outliers": any(r["column"] == col for r in outlier_report),
            "llm_reasoning": entry.get("reasoning", ""),
        }
        column_profiles.append(profile)

        if rg:
            viz_ready.append(rg["new_column"])
        elif cls != "id_column":
            viz_ready.append(col)

    insights = plan.get("insights", [])
    clean_rows = df.where(pd.notna(df), None).to_dict(orient="records")

    return {
        "eda_summary": {
            "original_rows": original_rows,
            "duplicates_removed": duplicates_removed,
            "clean_rows": len(df),
            "columns_analyzed": len(column_profiles),
            "columns_dropped": dropped_columns,
            "nulls_imputed": nulls_imputed,
            "outliers_flagged": {r["column"]: r["outlier_count"] for r in outlier_report},
            "type_fixes": type_fixes,
        },
        "column_profiles": column_profiles,
        "binary_decodings": binary_decodings,
        "range_groupings": range_groupings,
        "outlier_report": outlier_report,
        "visualization_ready_columns": list(dict.fromkeys(viz_ready)),
        "excluded_columns": excluded + dropped_columns,
        "eda_insights": insights,
        "clean_rows": clean_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Utility helpers (mechanical — no analytical decisions)
# ─────────────────────────────────────────────────────────────────────────────

def _assign_bucket(value: Any, buckets: dict) -> str:
    """Assign a row value to a bucket label from the LLM-produced bucket map."""
    import re as _re
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)

    for label, rng in buckets.items():
        parts = _re.split(r'(?<=\d)-', str(rng))
        if len(parts) == 2:
            try:
                lo, hi = float(parts[0]), float(parts[1])
                if lo <= v <= hi:
                    return label
            except ValueError:
                continue
    return "Other"


def _safe_scalar(val: Any) -> Any:
    if val is None:
        return None
    try:
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        if isinstance(val, (np.integer,)):
            return int(val)
        if isinstance(val, (np.floating,)):
            f = float(val)
            return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
        return val
    except Exception:
        return None


def _empty_result() -> dict:
    return {
        "eda_summary": {
            "original_rows": 0, "duplicates_removed": 0, "clean_rows": 0,
            "columns_analyzed": 0, "columns_dropped": [], "nulls_imputed": {},
            "outliers_flagged": {}, "type_fixes": {},
        },
        "column_profiles": [],
        "binary_decodings": [],
        "range_groupings": [],
        "outlier_report": [],
        "visualization_ready_columns": [],
        "excluded_columns": [],
        "eda_insights": [],
        "clean_rows": [],
    }
