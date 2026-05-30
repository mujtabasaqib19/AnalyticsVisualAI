from pydantic import BaseModel
from typing import Optional, Any

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
    quality_score: int
    issues: list[str]
    warnings: list[str]
    recommendation: str

class GenerateRequest(BaseModel):
    schema: dict
    userQuery: str
    dashboardType: str = "auto"  # Any domain string, or "auto" for Claude to self-detect
    sampleRows: Optional[list[dict]] = None

class ChartPosition(BaseModel):
    x: int
    y: int
    w: int
    h: int

class ChartSpec(BaseModel):
    id: str
    type: str
    title: str
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
