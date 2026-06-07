"""
EDA router — POST /eda
Accepts raw rows + schema + description, runs the EDA engine, returns results.
"""
from __future__ import annotations

import io
import csv
import re
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.eda_engine import run_eda

logger = logging.getLogger(__name__)
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
    All rows are passed to pandas for stats and cleaning.
    The LLM only ever sees the first 20 rows internally for its decisions.
    """
    try:
        result = await run_eda(
            rows=request.rows,
            schema=request.column_schema,
            description=request.description,
        )
        return result
    except ValueError as e:
        # ValueError = known failure (invalid/missing API key, LLM parse error).
        # Surface the real message so the frontend shows what actually went wrong.
        logger.error("EDA value error: %s", e)
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error("EDA processing error: %s", e, exc_info=True)
        raise HTTPException(500, f"EDA processing failed: {e}")


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

    safe_stem = re.sub(r"[^\w\-]", "_", request.filename.replace(".csv", ""))[:64]
    filename = f"{safe_stem}_cleaned.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
