import "server-only";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";


// Known domain-specific prompt files
const KNOWN_DOMAINS = new Set([
  "sales", "hr", "finance", "marketing", "healthcare", "education",
  "e-commerce", "supply-chain", "customer-support", "operations",
  "sports", "climate", "demographics", "real-estate", "agriculture",
  "energy", "social-media", "crime", "transportation", "economics",
  "product", "engineering", "devops", "food-beverage", "travel",
  "legal", "iot",
]);

function loadDomainContext(dashboardType: string): string {
  const universalPrompt = (() => {
    try {
      return fs.readFileSync(path.join(process.cwd(), "public", "prompts", "universal_dashboard.txt"), "utf-8");
    } catch {
      return "";
    }
  })();

  // Load domain-specific supplement if available
  const domainKey = dashboardType.toLowerCase().replace(/[\s/]+/g, "-");
  const domainPrompt = (() => {
    if (!KNOWN_DOMAINS.has(domainKey)) return "";
    try {
      return fs.readFileSync(path.join(process.cwd(), "public", "prompts", `${domainKey}_dashboard.txt`), "utf-8");
    } catch {
      return "";
    }
  })();

  return [universalPrompt, domainPrompt].filter(Boolean).join("\n\n---\n\n");
}

function buildSystemPrompt(dashboardType: string, domainContext: string): string {
  const isAutoDetect = dashboardType === "auto" || dashboardType === "general" || !dashboardType;
  const domainLine = isAutoDetect
    ? "Infer the domain from the column names, data types, and sample values. Use the domain detection guide above."
    : `The user has identified this as: "${dashboardType}" domain. Apply domain-specific best practices for this field.`;

  return `You are a world-class data visualization expert who works across ALL industries and domains.
Your task: analyze any dataset and generate the most insightful, domain-appropriate dashboard possible.

${domainContext ? domainContext + "\n\n---\n\n" : ""}INSTRUCTIONS:
${domainLine}

Output ONLY a single valid JSON object with this exact structure:
{
  "dashboard_title": "Descriptive title that names the domain and key insight",
  "theme": "dark_professional",
  "layout": "custom",
  "charts": [
    {
      "id": "chart_1",
      "type": "bar | line | area | pie | donut | scatter | kpi_card | table | funnel",
      "title": "Clear, specific chart title",
      "x_field": "exact_column_name_from_schema",
      "y_field": "exact_column_name_from_schema",
      "value_field": "exact_column_name_from_schema (kpi_card only)",
      "aggregation": "sum | avg | count | max | min",
      "color": "#hexcolor",
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 }
    }
  ],
  "suggested_insights": [
    "Specific insight 1 about this dataset",
    "Specific insight 2 about what to look for",
    "Specific insight 3 or anomaly to investigate"
  ]
}

GRID RULES (12 columns total - YOU MUST FILL ALL 12 COLUMNS HORIZONTALLY):
- KPI cards: w=3, h=2 (place 4 across: x=0, x=3, x=6, x=9) or w=4, h=2 (place 3 across: x=0, x=4, x=8)
- Wide charts (bar, line, area): w=8, h=5 (MUST be paired with a w=4 chart next to it: x=0 and x=8)
- Narrow charts (pie, donut, funnel): w=4, h=5 (pair with w=8, or put 3 across)
- Half-width charts: w=6, h=5 (place 2 across: x=0 and x=6)
- Full-width charts (table, scatter): w=12, h=5-6
- Stack rows: KPIs at y=0, main charts at y=2, secondary at y=7+
- IMPORTANT: Every row must have elements whose widths sum to exactly 12. Do not leave empty horizontal space.

CHART SELECTION RULES:
- ALWAYS include ≥1 KPI card for the primary metric
- ALWAYS include a time-series (line/area) if any date column exists
- ALWAYS include ≥1 categorical breakdown (bar or pie/donut)
- x_field and y_field MUST be exact column names from the schema
- For kpi_card: use value_field (not x/y), omit x_field
- For scatter: both x_field and y_field must be numeric
- For pie/donut/funnel: use x_field=category, y_field=metric

FIELD MAPPING RULES:
- y_field: pick numeric columns that represent the core metric (revenue, count, score, rate, etc.)
- x_field: pick categorical or date columns for the dimension
- Skip ID columns (ending in _id, _key, _code) as axis fields
- Use "count" aggregation when no obvious metric exists (count rows by category)

Generate 4-6 charts total. ONLY output the JSON. No markdown fences, no explanation.`;
}

export async function POST(req: NextRequest) {
  try {
    const { schema, userQuery, dashboardType, sampleRows } = await req.json();

    // Input validation
    if (!userQuery || typeof userQuery !== "string" || !userQuery.trim()) {
      return NextResponse.json({ error: "userQuery is required" }, { status: 400 });
    }
    if (userQuery.length > 5000) {
      return NextResponse.json({ error: "userQuery too long (max 5000 characters)" }, { status: 400 });
    }
    if (!schema || typeof schema !== "object") {
      return NextResponse.json({ error: "schema is required" }, { status: 400 });
    }
    if (dashboardType && typeof dashboardType !== "string") {
      return NextResponse.json({ error: "dashboardType must be a string" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const domainContext = loadDomainContext(dashboardType || "auto");
    const systemPrompt = buildSystemPrompt(dashboardType || "auto", domainContext);

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Dataset Schema:
${JSON.stringify(schema, null, 2)}

Sample Rows (first 10):
${JSON.stringify((sampleRows ?? []).slice(0, 10), null, 2)}

User Request: "${userQuery}"

Domain hint: ${dashboardType || "auto-detect from schema"}

Generate the dashboard specification JSON now.`,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON — handle markdown fences and leading text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in Claude response:", rawText.slice(0, 300));
      throw new Error("AI returned no valid JSON structure");
    }

    const dashboardSpec = JSON.parse(jsonMatch[0]);

    // Validate minimum structure
    if (!dashboardSpec.charts || !Array.isArray(dashboardSpec.charts)) {
      throw new Error("Invalid dashboard spec: missing charts array");
    }

    return NextResponse.json(dashboardSpec);
  } catch (error) {
    const msg = (error as Error).message ?? "Unknown error";
    console.error("Dashboard generation error:", msg);
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === "development"
          ? msg   // show real error in dev so you can debug
          : "Failed to generate dashboard. Please try again.",
      },
      { status: 500 }
    );
  }
}
