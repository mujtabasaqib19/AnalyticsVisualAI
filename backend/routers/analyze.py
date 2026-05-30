from fastapi import APIRouter
from pydantic import BaseModel
from services.schema import build_schema_summary, get_numeric_columns, get_dimension_columns

router = APIRouter()


class AnalyzeRequest(BaseModel):
    schema: dict


@router.post("/analyze")
async def analyze_schema(request: AnalyzeRequest):
    return {
        "summary": build_schema_summary(request.schema),
        "numeric_columns": get_numeric_columns(request.schema),
        "dimension_columns": get_dimension_columns(request.schema),
        "total_columns": len(request.schema.get("columns", [])),
        "row_count": request.schema.get("row_count", 0),
    }
