import pandas as pd
import numpy as np
from io import BytesIO
from typing import Tuple
import re


def infer_column_type(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"

    # Try parsing as dates
    sample = series.dropna().head(20).astype(str)
    date_patterns = [
        r'^\d{4}-\d{2}-\d{2}',
        r'^\d{2}/\d{2}/\d{4}',
        r'^\d{2}-\d{2}-\d{4}',
        r'^\w+ \d{1,2}, \d{4}',
    ]
    date_matches = sum(
        1 for v in sample
        if any(re.match(p, v) for p in date_patterns)
    )
    if date_matches / max(len(sample), 1) > 0.6:
        return "date"

    return "string"


def parse_dataframe(df: pd.DataFrame, file_name: str) -> dict:
    df = df.replace({np.nan: None})

    columns = []
    for col in df.columns:
        series = df[col].dropna()
        col_type = infer_column_type(df[col])

        col_info = {
            "name": str(col),
            "type": col_type,
            "null_count": int(df[col].isnull().sum()),
            "null_pct": round(df[col].isnull().mean() * 100, 1),
            "unique_count": int(df[col].nunique()),
            "sample_values": series.head(5).tolist(),
        }

        if col_type == "numeric":
            numeric = pd.to_numeric(series, errors="coerce").dropna()
            if len(numeric) > 0:
                col_info["min"] = float(numeric.min())
                col_info["max"] = float(numeric.max())

        columns.append(col_info)

    schema = {
        "columns": columns,
        "row_count": len(df),
        "suggested_metrics": [c["name"] for c in columns if c["type"] == "numeric"],
        "suggested_dimensions": [c["name"] for c in columns if c["type"] in ("string", "date")],
    }

    # Sample rows — convert to JSON-safe format
    sample = df.head(20).copy()
    for col in sample.select_dtypes(include=["datetime64"]):
        sample[col] = sample[col].astype(str)
    sample_rows = sample.to_dict(orient="records")

    return {
        "schema": schema,
        "sample_rows": sample_rows,
        "file_name": file_name,
        "row_count": len(df),
    }


async def parse_uploaded_file(file_bytes: bytes, filename: str) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower()
    buf = BytesIO(file_bytes)

    if ext == "csv":
        df = pd.read_csv(buf, on_bad_lines="skip")

    elif ext == "tsv":
        df = pd.read_csv(buf, sep="\t", on_bad_lines="skip")

    elif ext == "txt":
        # Try tab first, then comma, then let pandas sniff
        try:
            df = pd.read_csv(buf, sep="\t", on_bad_lines="skip")
            if df.shape[1] == 1:          # single column → try comma
                buf.seek(0)
                df = pd.read_csv(buf, sep=",", on_bad_lines="skip")
        except Exception:
            buf.seek(0)
            df = pd.read_csv(buf, sep=None, engine="python", on_bad_lines="skip")

    elif ext in ("xlsx", "xls", "xlsm", "xlsb", "ods"):
        df = pd.read_excel(buf, engine="openpyxl" if ext in ("xlsx", "xlsm", "ods") else "xlrd")

    elif ext == "json":
        try:
            df = pd.read_json(buf)
        except Exception:
            buf.seek(0)
            import json
            raw = json.loads(file_bytes)
            # Handle { data: [...] } wrappers
            if isinstance(raw, dict):
                for v in raw.values():
                    if isinstance(v, list):
                        raw = v
                        break
            df = pd.DataFrame(raw if isinstance(raw, list) else [raw])

    elif ext == "xml":
        df = pd.read_xml(buf)

    elif ext == "parquet":
        df = pd.read_parquet(buf)

    elif ext == "feather":
        import pyarrow.feather as feather
        df = feather.read_feather(buf)

    else:
        raise ValueError(f"Unsupported file type: .{ext}")

    # Normalize column names
    df.columns = [str(c).strip() for c in df.columns]

    return parse_dataframe(df, filename)
