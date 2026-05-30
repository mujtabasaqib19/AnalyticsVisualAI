"""
EDA Engine — pure-Python / pandas analysis service.
Runs all transformations and returns a structured EDA result dict.
"""
from __future__ import annotations

import math
import copy
from typing import Any

import numpy as np
import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_eda(rows: list[dict], schema: list[dict], description: str) -> dict:
    """
    Main EDA function.

    Parameters
    ----------
    rows        : list of row dicts (raw, as parsed)
    schema      : list of {name, type, nullCount, uniqueCount, sampleValues,
                           min?, max?} – from the frontend parser
    description : plain-English description of the dataset

    Returns
    -------
    Full EDA result dict matching the agreed output JSON schema.
    """
    if not rows:
        return _empty_result()

    df = pd.DataFrame(rows)
    original_rows = len(df)

    # ── 1. Duplicate removal ─────────────────────────────────────────────────
    df_clean = df.drop_duplicates()
    duplicates_removed = original_rows - len(df_clean)
    df = df_clean.copy()

    # ── Build column lookup ──────────────────────────────────────────────────
    schema_map: dict[str, dict] = {c["name"]: c for c in schema}
    col_names = [c for c in df.columns if c in schema_map]

    # ── 2. Classify columns ──────────────────────────────────────────────────
    classifications: dict[str, str] = {}
    for col in col_names:
        classifications[col] = _classify_column(df[col], schema_map[col])

    # ── 3. Type fixes ─────────────────────────────────────────────────────────
    type_fixes: dict[str, str] = {}
    for col in col_names:
        cls = classifications[col]
        if cls in ("numeric_continuous", "numeric_discrete", "high_cardinality_numeric",
                   "binary"):
            df[col], fixed = _coerce_numeric(df[col])
            if fixed:
                type_fixes[col] = "string → numeric"
        elif cls == "date":
            df[col], fixed = _coerce_date(df[col])
            if fixed:
                type_fixes[col] = "string → datetime"

    # ── 4. Missing value imputation ──────────────────────────────────────────
    nulls_imputed: dict[str, Any] = {}
    dropped_columns: list[str] = []

    for col in col_names:
        null_count = int(df[col].isna().sum())
        null_pct = null_count / len(df) if len(df) > 0 else 0

        if null_pct > 0.40:
            dropped_columns.append(col)
            continue

        if null_count > 0:
            cls = classifications[col]
            if cls in ("numeric_continuous", "numeric_discrete",
                       "high_cardinality_numeric", "binary"):
                fill_val = df[col].median()
                if pd.isna(fill_val):
                    fill_val = 0
                df[col] = df[col].fillna(fill_val)
                nulls_imputed[col] = {"method": "median", "value": _safe_scalar(fill_val)}
            else:
                mode_vals = df[col].mode()
                fill_val = mode_vals.iloc[0] if len(mode_vals) > 0 else "Unknown"
                df[col] = df[col].fillna(fill_val)
                nulls_imputed[col] = {"method": "mode", "value": str(fill_val)}

    # Drop columns with > 40% nulls
    df = df.drop(columns=dropped_columns, errors="ignore")
    for dc in dropped_columns:
        col_names.remove(dc)

    # ── 5. Binary decoding ───────────────────────────────────────────────────
    binary_decodings: list[dict] = []
    for col in col_names:
        if classifications[col] == "binary":
            labels = _infer_binary_labels(col, description)
            binary_decodings.append({
                "column": col,
                "0_label": labels[0],
                "1_label": labels[1],
            })
            df[col] = df[col].map({0: labels[0], 1: labels[1],
                                   0.0: labels[0], 1.0: labels[1],
                                   "0": labels[0], "1": labels[1],
                                   False: labels[0], True: labels[1]})

    # ── 6. Range-based grouping ───────────────────────────────────────────────
    range_groupings: list[dict] = []
    for col in col_names:
        if classifications[col] == "high_cardinality_numeric":
            buckets, new_col_name = _build_range_groups(df, col, schema_map.get(col, {}))
            if buckets:
                df[new_col_name] = df[col].apply(lambda v: _assign_bucket(v, buckets))
                range_groupings.append({
                    "original_column": col,
                    "new_column": new_col_name,
                    "buckets": buckets,
                })

    # ── 7. Outlier detection (IQR) ────────────────────────────────────────────
    outlier_report: list[dict] = []
    outlier_flags: dict[str, list[bool]] = {}
    for col in col_names:
        if classifications[col] in ("numeric_continuous", "numeric_discrete",
                                    "high_cardinality_numeric"):
            series = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(series) < 4:
                continue
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            iqr = q3 - q1
            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            mask = (pd.to_numeric(df[col], errors="coerce") < lower) | \
                   (pd.to_numeric(df[col], errors="coerce") > upper)
            count = int(mask.sum())
            if count > 0:
                outlier_report.append({"column": col, "outlier_count": count,
                                       "action": "flagged"})
                outlier_flags[col] = mask.tolist()

    # ── 8. Build column profiles ──────────────────────────────────────────────
    column_profiles: list[dict] = []
    excluded: list[str] = []
    viz_ready: list[str] = []

    for col in col_names:
        cls = classifications[col]
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

        # Transformation description
        tx = []
        if col in nulls_imputed:
            tx.append(f"null imputation ({nulls_imputed[col]['method']})")
        if col in type_fixes:
            tx.append(f"type fix ({type_fixes[col]})")
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
            "recommended_chart": _recommend_chart(cls, unique_count),
            "has_outliers": any(r["column"] == col for r in outlier_report),
        }
        column_profiles.append(profile)

        # Build viz-ready column list
        if rg:
            viz_ready.append(rg["new_column"])
        elif cls != "id_column":
            viz_ready.append(col)

    # ── 9. EDA insights ───────────────────────────────────────────────────────
    insights = _generate_insights(df, column_profiles, outlier_report,
                                  binary_decodings, range_groupings, duplicates_removed)

    # ── 10. Return cleaned rows (with transformations applied) ────────────────
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
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _classify_column(series: pd.Series, sch: dict) -> str:
    col_type = sch.get("type", "string")
    unique_count = int(series.nunique())
    total = len(series)
    col_name_lower = sch.get("name", "").lower()

    # ID column heuristics
    if unique_count == total and total > 50:
        if any(kw in col_name_lower for kw in ("id", "_id", "uuid", "key", "index")):
            return "id_column"

    if col_type == "date":
        return "date"

    if col_type == "boolean":
        return "binary"

    if col_type == "numeric":
        non_null = series.dropna()
        # Check binary
        unique_vals = set(non_null.unique())
        if unique_vals.issubset({0, 1, 0.0, 1.0, "0", "1", True, False}):
            return "binary"

        if unique_count <= 2:
            return "binary"

        if unique_count <= 8:
            # Check if it's integers with small range — categorical-like
            try:
                nums = pd.to_numeric(non_null, errors="coerce").dropna()
                all_int = (nums == nums.round()).all()
                if all_int and unique_count <= 5:
                    return "numeric_discrete"
            except Exception:
                pass
            return "numeric_discrete"

        # Wide-range numeric: high cardinality
        try:
            nums = pd.to_numeric(non_null, errors="coerce").dropna()
            if len(nums) == 0:
                return "numeric_continuous"
            val_min, val_max = nums.min(), nums.max()
            val_range = val_max - val_min

            all_int = (nums == nums.round()).all()
            # If all integers with >5 unique values and range > 5 → high_cardinality_numeric
            if all_int and unique_count > 5 and val_range > 5:
                return "high_cardinality_numeric"
            # Floats/decimals
            if not all_int:
                return "numeric_continuous"
        except Exception:
            pass
        return "numeric_discrete"

    # String column
    if unique_count <= 20 or (total > 0 and unique_count / total < 0.05):
        return "categorical"
    return "high_cardinality_numeric" if col_type == "numeric" else "categorical"


def _coerce_numeric(series: pd.Series):
    if pd.api.types.is_numeric_dtype(series):
        return series, False
    converted = pd.to_numeric(series, errors="coerce")
    success_rate = converted.notna().sum() / max(len(series.dropna()), 1)
    if success_rate > 0.8:
        return converted, True
    return series, False


def _coerce_date(series: pd.Series):
    if pd.api.types.is_datetime64_any_dtype(series):
        return series, False
    try:
        converted = pd.to_datetime(series, errors="coerce")
        success_rate = converted.notna().sum() / max(len(series.dropna()), 1)
        if success_rate > 0.7:
            return converted.astype(str), True
    except Exception:
        pass
    return series, False


def _infer_binary_labels(col_name: str, description: str) -> tuple[str, str]:
    """Return (0_label, 1_label) based on column name heuristics."""
    col_lower = col_name.lower()
    desc_lower = description.lower()

    patterns = {
        ("holiday", "holiday_flag", "is_holiday"):    ("Regular Week", "Holiday Week"),
        ("depression",):                               ("No Depression", "Depression"),
        ("is_active", "active"):                       ("Inactive", "Active"),
        ("is_employed", "employed"):                   ("Unemployed", "Employed"),
        ("is_male", "gender_male"):                    ("Female", "Male"),
        ("is_female",):                                ("Male", "Female"),
        ("weekend",):                                  ("Weekday", "Weekend"),
        ("churn",):                                    ("Retained", "Churned"),
        ("fraud", "is_fraud"):                         ("Legitimate", "Fraudulent"),
        ("default", "loan_default"):                   ("No Default", "Default"),
        ("converted", "conversion"):                   ("Not Converted", "Converted"),
        ("promoted",):                                 ("Not Promoted", "Promoted"),
        ("sick", "illness"):                           ("Healthy", "Sick"),
        ("smoker", "smoking"):                         ("Non-Smoker", "Smoker"),
        ("cancelled",):                                ("Active", "Cancelled"),
        ("completed",):                                ("Incomplete", "Completed"),
    }
    for keys, labels in patterns.items():
        if any(k in col_lower for k in keys):
            return labels

    return ("No", "Yes")


def _build_range_groups(df: pd.DataFrame, col: str, sch: dict) -> tuple[dict, str]:
    """Auto-generate meaningful buckets for high_cardinality_numeric columns."""
    new_col_name = col + "_group"
    series = pd.to_numeric(df[col], errors="coerce").dropna()
    if len(series) == 0:
        return {}, new_col_name

    val_min = float(series.min())
    val_max = float(series.max())
    val_range = val_max - val_min
    col_lower = col.lower()

    # ── Named heuristics ──────────────────────────────────────────────────────
    if any(k in col_lower for k in ("addiction", "stress", "anxiety", "severity",
                                     "level", "score", "rating", "intensity")):
        # Determine scale
        if val_max <= 5:
            buckets = {"Low": "1-2", "Medium": "3", "High": "4-5"}
        elif val_max <= 10:
            buckets = {"Low": "1-3", "Medium": "4-6", "High": "7-10"}
        elif val_max <= 100:
            buckets = {"Low": "0-33", "Medium": "34-66", "High": "67-100"}
        else:
            buckets = _equal_width_buckets(val_min, val_max, 4,
                                           ["Low", "Medium", "High", "Very High"])
        return buckets, new_col_name

    if "age" in col_lower:
        if val_min >= 13 and val_max <= 19:
            buckets = {"Early Teen": "13-14", "Mid Teen": "15-16", "Late Teen": "17-19"}
        elif val_min >= 18 and val_max <= 35:
            buckets = {"Young Adult": "18-25", "Adult": "26-35"}
        elif val_max <= 100:
            buckets = {"Youth": f"{int(val_min)}-25", "Adult": "26-40",
                       "Middle Age": "41-60", "Senior": f"61-{int(val_max)}"}
        else:
            buckets = _equal_width_buckets(val_min, val_max, 4,
                                           ["Youth", "Young Adult", "Adult", "Senior"])
        return buckets, new_col_name

    if any(k in col_lower for k in ("sleep", "hours", "duration")):
        if val_max <= 24:
            buckets = {"Short": f"{int(val_min)}-5", "Average": "6-8",
                       "Long": f"9-{int(val_max)}"}
        else:
            buckets = _equal_width_buckets(val_min, val_max, 3, ["Low", "Medium", "High"])
        return buckets, new_col_name

    if any(k in col_lower for k in ("income", "salary", "revenue", "amount",
                                     "price", "cost", "spend")):
        buckets = _quartile_buckets(series, ["Low", "Medium", "High", "Very High"])
        return buckets, new_col_name

    if any(k in col_lower for k in ("percent", "pct", "rate", "ratio")):
        buckets = {"Low": "0-33", "Medium": "34-66", "High": "67-100"}
        return buckets, new_col_name

    # ── Generic equal-width fallback ──────────────────────────────────────────
    if val_range <= 10:
        n_buckets = 3
        labels = ["Low", "Medium", "High"]
    elif val_range <= 50:
        n_buckets = 4
        labels = ["Low", "Medium", "High", "Very High"]
    else:
        n_buckets = 4
        labels = ["Low", "Medium", "High", "Very High"]

    buckets = _equal_width_buckets(val_min, val_max, n_buckets, labels)
    return buckets, new_col_name


def _equal_width_buckets(val_min: float, val_max: float,
                          n: int, labels: list[str]) -> dict:
    step = (val_max - val_min) / n
    buckets = {}
    for i, label in enumerate(labels):
        lo = val_min + i * step
        hi = val_max if i == n - 1 else lo + step
        buckets[label] = f"{int(lo)}-{int(hi)}"
    return buckets


def _quartile_buckets(series: pd.Series, labels: list[str]) -> dict:
    q = [series.quantile(i / len(labels)) for i in range(len(labels) + 1)]
    buckets = {}
    for i, label in enumerate(labels):
        buckets[label] = f"{int(q[i])}-{int(q[i+1])}"
    return buckets


def _assign_bucket(value: Any, buckets: dict) -> str:
    """Assign a row value to a bucket label.

    Handles negative numbers in ranges (e.g. '-10-0') by splitting only on
    hyphens that are immediately preceded by a digit character.
    """
    import re as _re
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)

    for label, rng in buckets.items():
        # Split on a hyphen that is preceded by a digit (handles negatives)
        parts = _re.split(r'(?<=\d)-', str(rng))
        if len(parts) == 2:
            try:
                lo, hi = float(parts[0]), float(parts[1])
                if lo <= v <= hi:
                    return label
            except ValueError:
                continue
    return "Other"


def _recommend_chart(classification: str, unique_count: int) -> str:
    mapping = {
        "categorical":              "bar" if unique_count <= 8 else "donut",
        "binary":                   "donut",
        "numeric_continuous":       "scatter" if unique_count > 50 else "area",
        "numeric_discrete":         "bar",
        "high_cardinality_numeric": "bar",  # always use _group version
        "date":                     "line",
        "id_column":                "none",
    }
    return mapping.get(classification, "bar")


def _generate_insights(df: pd.DataFrame, profiles: list[dict],
                       outlier_report: list[dict],
                       binary_decodings: list[dict],
                       range_groupings: list[dict],
                       duplicates_removed: int) -> list[str]:
    insights = []
    if duplicates_removed > 0:
        insights.append(f"🔁 {duplicates_removed} duplicate rows were removed before analysis.")

    high_null = [p for p in profiles if p["null_pct"] > 20]
    if high_null:
        cols = ", ".join(p["name"] for p in high_null)
        insights.append(f"⚠️ High null rate (>20%) detected in: {cols}. Median/mode imputation applied.")

    if outlier_report:
        total_outliers = sum(r["outlier_count"] for r in outlier_report)
        cols = ", ".join(r["column"] for r in outlier_report)
        insights.append(f"📊 {total_outliers} statistical outliers detected across columns: {cols}. "
                        f"Charts will show ⚠ warning flags.")

    if binary_decodings:
        cols = ", ".join(b["column"] for b in binary_decodings)
        insights.append(f"🏷️ Binary columns decoded with meaningful labels: {cols}.")

    if range_groupings:
        for rg in range_groupings:
            buckets_str = " | ".join(
                f"{k}: {v}" for k, v in list(rg["buckets"].items())[:3]
            )
            insights.append(
                f"📦 '{rg['original_column']}' grouped into '{rg['new_column']}': {buckets_str}")

    num_profiles = [p for p in profiles if p["classification"] in
                    ("numeric_continuous", "numeric_discrete", "high_cardinality_numeric")]
    if num_profiles:
        highest_mean = max(num_profiles, key=lambda p: p.get("mean") or 0)
        if highest_mean.get("mean") is not None:
            insights.append(
                f"📈 Highest average value: '{highest_mean['name']}' "
                f"with mean = {highest_mean['mean']:.2f}")

    cat_profiles = [p for p in profiles if p["classification"] == "categorical"]
    if cat_profiles:
        most_diverse = max(cat_profiles, key=lambda p: p["unique_count"])
        insights.append(
            f"🗂️ Most diverse categorical column: '{most_diverse['name']}' "
            f"with {most_diverse['unique_count']} unique values.")

    return insights


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
