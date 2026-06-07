"""
POST /join

Merges 2–4 uploaded datasets on a shared column key.
Supports inner, left, and outer joins.
Returns the merged rows + a fresh schema ready for dashboard generation.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from typing import Literal
import logging
import pandas as pd

from services.parser import parse_dataframe

logger = logging.getLogger(__name__)
router = APIRouter()


class JoinFile(BaseModel):
    rows: list[dict]
    file_name: str


class JoinRequest(BaseModel):
    files: list[JoinFile]
    join_key: str
    join_type: Literal["inner", "left", "outer"] = "inner"

    @field_validator("files")
    @classmethod
    def validate_files(cls, v: list) -> list:
        if len(v) < 2:
            raise ValueError("At least 2 files are required to join")
        if len(v) > 4:
            raise ValueError("Maximum 4 files can be joined at once")
        return v

    @field_validator("join_key")
    @classmethod
    def validate_join_key(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("join_key cannot be empty")
        return v


@router.post("/join")
async def join_files(request: JoinRequest):
    try:
        dfs: list[tuple[pd.DataFrame, str]] = []
        for f in request.files:
            if not f.rows:
                raise HTTPException(400, f"File '{f.file_name}' has no rows")
            df = pd.DataFrame(f.rows)
            if request.join_key not in df.columns:
                raise HTTPException(
                    400,
                    f"Join key '{request.join_key}' not found in '{f.file_name}'. "
                    f"Available columns: {', '.join(df.columns.tolist())}"
                )
            dfs.append((df, f.file_name))

        # Sequential merge: (f1 ⋈ f2) ⋈ f3 ⋈ f4
        merged = dfs[0][0]
        for df, fname in dfs[1:]:
            # Identify conflicting non-key columns and suffix them
            left_cols  = set(merged.columns) - {request.join_key}
            right_cols = set(df.columns)     - {request.join_key}
            overlap    = left_cols & right_cols
            suffix     = f"_{fname.rsplit('.', 1)[0]}" if "." in fname else f"_{fname}"
            merged = merged.merge(
                df,
                on=request.join_key,
                how=request.join_type,
                suffixes=("", suffix) if overlap else ("", ""),
            )

        if merged.empty:
            raise HTTPException(
                400,
                f"Join on '{request.join_key}' ({request.join_type}) produced 0 rows. "
                "Try a different join type or check that the key values overlap."
            )

        # Collect stats before generating the schema
        original_rows = [len(pd.DataFrame(f.rows)) for f in request.files]
        merged_rows   = len(merged)

        # Re-use the existing schema generator
        file_names = [f.file_name for f in request.files]
        merged_name = f"merged_{'_'.join(n.rsplit('.', 1)[0] for n in file_names)}.csv"
        result = parse_dataframe(merged, merged_name)

        return {
            **result,
            "join_stats": {
                "files":         file_names,
                "join_key":      request.join_key,
                "join_type":     request.join_type,
                "input_rows":    original_rows,
                "merged_rows":   merged_rows,
                "merged_columns": len(merged.columns),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Join error: {e}", exc_info=True)
        raise HTTPException(500, "Join failed. Please check that the key column exists in all files.")
