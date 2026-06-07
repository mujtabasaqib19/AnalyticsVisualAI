from pydantic import BaseModel, field_validator
from typing import Optional, Any
import config

VALID_CHART_TYPES = {
    "bar", "line", "area", "pie", "donut", "scatter",
    "kpi_card", "table", "funnel", "gauge", "heatmap",
}


class ColumnInfo(BaseModel):
    name: str
    type: str  # "numeric", "string", "date", "boolean"
    null_count: int
    unique_count: int
    sample_values: list[Any]
    min: Optional[float] = None
    max: Optional[float] = None
    null_pct: Optional[float] = None

class DataSchema(BaseModel):
    columns: list[ColumnInfo]
    row_count: int
    suggested_metrics: list[str]
    suggested_dimensions: list[str]

class UploadResponse(BaseModel):
    schema_: DataSchema
    sample_rows: list[dict]
    file_name: str
    row_count: int

class ValidationRequest(BaseModel):
    schema: dict
    sample_rows: list[dict]

class ValidationResult(BaseModel):
    quality_score: Optional[int] = None
    issues: list[str] = []
    warnings: list[str] = []
    recommendation: str = ""
    llm_driven: Optional[bool] = None

class GenerateRequest(BaseModel):
    schema: dict
    userQuery: str
    dashboardType: str = "auto"
    sampleRows: Optional[list[dict]] = None
    quality_context: Optional[dict] = None  # Gemini's ValidationResult — feeds into Claude's A2A prompt

    @field_validator("userQuery")
    @classmethod
    def validate_user_query(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("userQuery cannot be empty")
        if len(v) > config.MAX_QUERY_LENGTH:
            raise ValueError(f"userQuery must be {config.MAX_QUERY_LENGTH} characters or fewer")
        return v

    @field_validator("dashboardType")
    @classmethod
    def validate_dashboard_type(cls, v: str) -> str:
        return v.lower().strip() if v else "auto"

class ChartPosition(BaseModel):
    x: int
    y: int
    w: int
    h: int

class ChartSpec(BaseModel):
    id: str
    type: str
    title: str

    @field_validator("type")
    @classmethod
    def validate_chart_type(cls, v: str) -> str:
        return v if v in VALID_CHART_TYPES else "bar"
    x_field: Optional[str] = None
    y_field: Optional[str] = None
    value_field: Optional[str] = None
    aggregation: Optional[str] = "sum"
    color: Optional[str] = None
    position: ChartPosition
    filters: Optional[dict] = None

class DashboardSpec(BaseModel):
    dashboard_title: str
    theme: str
    layout: str
    charts: list[ChartSpec]
    suggested_insights: Optional[list[str]] = None
