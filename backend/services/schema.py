from typing import Any


def build_schema_summary(schema: dict) -> str:
    """Build a human-readable schema summary for prompts."""
    lines = []
    for col in schema.get("columns", []):
        line = f"- {col['name']} ({col['type']})"
        if col.get("min") is not None:
            line += f", range: {col['min']} to {col['max']}"
        if col.get("null_pct", 0) > 0:
            line += f", {col['null_pct']}% nulls"
        lines.append(line)
    return "\n".join(lines)


def get_numeric_columns(schema: dict) -> list[str]:
    return [c["name"] for c in schema.get("columns", []) if c["type"] == "numeric"]


def get_dimension_columns(schema: dict) -> list[str]:
    return [c["name"] for c in schema.get("columns", []) if c["type"] in ("string", "date")]
