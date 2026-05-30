"""
EDA router — POST /eda
Accepts raw rows + schema + description, runs the EDA engine, returns results.
"""
from __future__ import annotations

import io
import csv
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.eda_engine import run_eda

router = APIRouter()


class EDARequest(BaseModel):
    rows: list[dict[str, Any]]
    column_schema: list[dict[str, Any]]   # ColumnInfo[] from frontend parser
    description: str = ""


class EDADownloadRequest(BaseModel):
    clean_rows: list[dict[str, Any]]
    filename: str = "cleaned_data.csv"


@router.post("/eda")
async def run_eda_endpoint(request: EDARequest) -> dict:
    """
    Run the full EDA pipeline on the provided dataset.
    Returns a structured JSON report + cleaned rows.
    """
    result = run_eda(
        rows=request.rows,
        schema=request.column_schema,
        description=request.description,
    )
    return result


@router.post("/eda/download")
async def download_cleaned_csv(request: EDADownloadRequest):
    """
    Return cleaned rows as a downloadable CSV file.
    """
    if not request.clean_rows:
        return {"error": "No rows to download"}

    output = io.StringIO()
    fieldnames = list(request.clean_rows[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(request.clean_rows)
    output.seek(0)

    filename = request.filename.replace(".csv", "") + "_cleaned.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
