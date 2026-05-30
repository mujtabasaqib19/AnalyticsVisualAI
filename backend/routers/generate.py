import os
import json
import re
from fastapi import APIRouter, HTTPException
from models.dashboard import GenerateRequest, DashboardSpec
import anthropic
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS_DIR = os.path.join(BASE_DIR, "prompts")

KNOWN_DOMAINS = {
    "sales", "hr", "finance", "marketing", "healthcare", "education",
    "e-commerce", "supply-chain", "customer-support", "operations",
    "sports", "climate", "demographics", "real-estate", "agriculture",
    "energy", "social-media", "crime", "transportation", "economics",
    "product", "engineering", "devops", "food-beverage", "travel",
    "legal", "iot",
}


def load_domain_context(dashboard_type: str) -> str:
    parts = []

    # Always load universal prompt
    universal_path = os.path.join(PROMPTS_DIR, "universal_dashboard.txt")
    try:
        with open(universal_path, "r") as f:
            parts.append(f.read())
    except FileNotFoundError:
        pass

    # Load domain-specific supplement if it exists
    domain_key = re.sub(r"[\s/]+", "-", dashboard_type.lower())
    if domain_key in KNOWN_DOMAINS:
        domain_path = os.path.join(PROMPTS_DIR, f"{domain_key}_dashboard.txt")
        try:
            with open(domain_path, "r") as f:
                parts.append(f.read())
        except FileNotFoundError:
            pass

    return "\n\n---\n\n".join(parts)


def build_system_prompt(dashboard_type: str, domain_context: str) -> str:
    is_auto = dashboard_type in ("auto", "general", "")
    domain_line = (
        "Infer the domain from the column names, data types, and sample values. Use the domain detection guide above."
        if is_auto
        else f'The user has identified this as: "{dashboard_type}" domain. Apply best practices for this field.'
    )

    return f"""You are a world-class data visualization expert who works across ALL industries and domains.
Your task: analyze any dataset and generate the most insightful, domain-appropriate dashboard.

{domain_context + chr(10) + chr(10) + "---" + chr(10) + chr(10) if domain_context else ""}INSTRUCTIONS:
{domain_line}

Output ONLY a single valid JSON object:
{{
  "dashboard_title": "Descriptive title naming the domain and key insight",
  "theme": "dark_professional",
  "layout": "custom",
  "charts": [
    {{
      "id": "chart_1",
      "type": "bar | line | area | pie | donut | scatter | kpi_card | table | funnel",
      "title": "Clear specific title",
      "x_field": "exact_column_name",
      "y_field": "exact_column_name",
      "value_field": "exact_column_name (kpi_card only)",
      "aggregation": "sum | avg | count | max | min",
      "color": "#hexcolor",
      "position": {{"x": 0, "y": 0, "w": 6, "h": 4}}
    }}
  ],
  "suggested_insights": ["insight 1", "insight 2", "insight 3"]
}}

GRID RULES (12 columns):
- KPI cards: w=3, h=2 (at x=0, 3, 6, 9; y=0)
- Wide charts: w=8, h=5
- Narrow charts (pie/donut/funnel): w=4, h=5
- Full-width (scatter/table): w=12, h=5-6

CHART RULES:
- ALWAYS include ≥1 KPI card
- ALWAYS include time-series if date column exists
- ALWAYS include ≥1 categorical breakdown
- x_field/y_field must be exact column names from schema
- kpi_card uses value_field (no x_field)
- Skip _id, _key, _code columns as axis fields
- Use count aggregation when no obvious numeric metric exists

Generate 4-6 charts. ONLY output JSON. No markdown fences."""


@router.post("/generate", response_model=DashboardSpec)
async def generate_dashboard(request: GenerateRequest):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY not configured")
        raise HTTPException(500, "Configuration error")

    client = anthropic.Anthropic(api_key=api_key)
    domain_context = load_domain_context(request.dashboardType or "auto")
    system_prompt = build_system_prompt(request.dashboardType or "auto", domain_context)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=3000,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": (
                    f"Dataset Schema:\n{json.dumps(request.schema, indent=2)}\n\n"
                    f"Sample Rows (first 10):\n{json.dumps((request.sampleRows or [])[:10], indent=2)}\n\n"
                    f'User Request: "{request.userQuery}"\n\n'
                    f"Domain hint: {request.dashboardType or 'auto-detect from schema'}\n\n"
                    "Generate the dashboard specification JSON now."
                )
            }]
        )

        raw = message.content[0].text if message.content[0].type == "text" else ""
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            raise ValueError("Claude returned no valid JSON structure")

        spec = json.loads(json_match.group())
        if not spec.get("charts"):
            raise ValueError("Invalid dashboard spec: missing charts")

        return DashboardSpec(**spec)
    except Exception as e:
        logger.error(f"Generation error: {str(e)}")
        raise HTTPException(500, "Dashboard generation failed. Please try again.")
