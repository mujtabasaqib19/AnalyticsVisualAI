import "server-only";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MAX_QUERY_LENGTH, DASHBOARD_SAMPLE_ROWS, MAX_CLAUDE_TOKENS } from "@/lib/constants";

// ── Tools Claude can call ─────────────────────────────────────────────────────

const VALIDATE_TOOL = {
  name: "validate_data_quality",
  description:
    "Assess dataset quality via Gemini before generating the dashboard. " +
    "Always call this after any join (or immediately for single-file). " +
    "Use the quality_score to calibrate chart complexity:\n" +
    "• score < 50  → Simple charts only (bar, kpi_card, table). Flag issues in suggested_insights.\n" +
    "• score 50–79 → Normal chart selection. Prefer robust types.\n" +
    "• score ≥ 80  → Full optimized dashboard.",
  input_schema: {
    type: "object" as const,
    properties: {
      schema:      { type: "object" as const, description: "Dataset schema" },
      sample_rows: { type: "array"  as const, description: "Sample rows (up to 10)" },
    },
    required: ["schema", "sample_rows"],
  },
};

const JOIN_TOOL = {
  name: "perform_join",
  description:
    "Merge multiple uploaded datasets into one before visualization. " +
    "Use this whenever 2+ files are present that share a common column. " +
    "Analyze all schemas, choose the best join key, and pick the join type that matches the user's intent:\n" +
    "• inner: keep only rows that match in ALL files (clean, no nulls)\n" +
    "• left:  keep all rows from the first file, fill nulls for missing matches\n" +
    "• outer: keep all rows from all files (may introduce many nulls)\n" +
    "After calling this, call validate_data_quality on the merged result, then generate the dashboard.",
  input_schema: {
    type: "object" as const,
    properties: {
      join_key: {
        type: "string" as const,
        description: "The column name to join on — must exist in all files",
      },
      join_type: {
        type: "string" as const,
        enum: ["inner", "left", "outer"],
        description: "Join strategy based on the analytical intent",
      },
      reasoning: {
        type: "string" as const,
        description: "Why you chose this key and join type given the schemas and user query",
      },
    },
    required: ["join_key", "join_type", "reasoning"],
  },
};

// ── Tool execution helpers ────────────────────────────────────────────────────

async function executeValidationTool(input: { schema: object; sample_rows: object[] }) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${backendUrl}/validate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ schema: input.schema, sample_rows: input.sample_rows }),
    });
    if (!res.ok) throw new Error(`Validate returned ${res.status}`);
    return await res.json();
  } catch {
    return {
      quality_score:  null,
      issues:         [],
      warnings:       ["Gemini validation unavailable — proceeding without quality score."],
      recommendation: "Set GEMINI_API_KEY in your .env to enable data quality analysis.",
      llm_driven:     false,
    };
  }
}

async function executeJoinTool(
  input:   { join_key: string; join_type: string; reasoning: string },
  files:   { fileName: string; rows: object[] }[]
) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${backendUrl}/join`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        files:     files.map((f) => ({ rows: f.rows, file_name: f.fileName })),
        join_key:  input.join_key,
        join_type: input.join_type,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Join failed" }));
      throw new Error(err.detail ?? `Join returned ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(domainHint: string, fileCount: number): string {
  const domainCtx = domainHint && domainHint !== "auto" && domainHint !== "general"
    ? `The user described this data as: "${domainHint}". Use this as a strong hint but always verify field names against the actual schema — column names are the ground truth.`
    : "Infer the domain entirely from column names, sample values, and data shape. Do not assume any domain.";

  const multiFileCtx = fileCount > 1
    ? `\nMULTI-FILE WORKFLOW (${fileCount} files detected):
1. Examine ALL schemas carefully. Look for a column that appears in multiple files with matching names or semantics.
2. If a common join key exists → call perform_join with the best key and join type.
3. If NO common key exists → treat each file independently and produce a combined dashboard with labeled section titles.
4. After joining (or for single file), call validate_data_quality on the final schema.
5. Generate the dashboard from the (merged) data.\n`
    : "";

  return `You are a world-class data analyst AI. Your job is to study ANY dataset — regardless of domain, size, or structure — and produce the single most insightful, visually diverse dashboard possible.
${domainCtx}
${multiFileCtx}
━━━ STEP 1: UNDERSTAND THE DATASET ━━━

Before selecting any charts, determine:

GRAIN: What does one row represent? (transaction, person, product, event, sensor reading, etc.)

DOMAIN: Detect from column names and sample values:
  Sales/E-commerce     → order, revenue, product, region, customer, discount, quantity, sales
  HR/People            → employee, salary, department, hire_date, tenure, headcount, performance
  Healthcare           → patient, diagnosis, treatment, age, bmi, vitals, medication, outcome
  Finance              → account, balance, transaction, credit, debit, interest, portfolio, return
  Logistics            → shipment, delivery, warehouse, carrier, lead_time, stock, route
  Marketing/Web        → campaign, impressions, clicks, ctr, conversion, channel, spend, roas
  IoT/Sensor           → timestamp, device_id, reading, temperature, humidity, pressure, anomaly
  Academic/Survey      → respondent, score, grade, subject, response, likert, frequency
  Real Estate          → property, price, sqft, bedrooms, location, listing_date, sold_date
  Sports/Games         → player, team, score, season, match, win, loss, stat, ranking
  Social Media         → post, likes, shares, followers, engagement, platform, sentiment
  Scientific           → sample, measurement, experiment, control, variable, p_value, result
  Generic/Unknown      → use column data types and unique value counts to infer shape

DIMENSIONS (group-by axes):
  → String columns with unique_count < 20% of row_count = good categorical dimension
  → Date/datetime columns = time dimension (always prioritize for line/area charts)
  → Boolean/binary columns = segmentation dimension

METRICS (values to measure):
  → Numeric columns = aggregatable metrics
  → If ZERO numeric columns exist → use COUNT of categorical columns

IDs (skip as chart axes):
  → unique_count ≈ row_count AND name contains: id, key, code, hash, uuid, index, ref, num, no., #
  → SKIP these for x_field and y_field. OK for value_field with aggregation=count.

━━━ STEP 2: AGGREGATION RULES ━━━

Revenue, cost, amount, price, sales, spend, budget, quantity, units, volume → SUM
Rate, ratio, score, percentage, pct, avg_, mean_, index, rating, satisfaction → AVG
Count of events, orders, transactions, incidents, visits, records → COUNT
Temperature, pressure, peak, max load, highest value → MAX
Minimum wage, floor price, best time, earliest → MIN

FORBIDDEN:
  ✗ NEVER sum a percentage or ratio (use avg)
  ✗ NEVER avg an ID or code field
  ✗ NEVER sum a boolean field (use count or avg)
  ✗ NEVER use count on a numeric column where sum/avg makes semantic sense

━━━ STEP 3: KPI CARD RULES (STRICTLY ENFORCED) ━━━

EVERY kpi_card MUST show a MEANINGFULLY DIFFERENT number from every other kpi_card.

RULE 1: No two KPI cards may share the same (value_field + aggregation) pair.
RULE 2: Do NOT use "count" on multiple string/ID columns — they ALL return total row count.
RULE 3: Use COUNT on at most ONE KPI. Use sum/avg/max/min for all remaining KPIs.
RULE 4: Before finalizing, mentally simulate each KPI value. If two would format to the same string (e.g. both "9.8K"), REPLACE one with a genuinely different metric.
RULE 5: For datasets with NO numeric columns, note this in suggested_insights and use COUNT on different dimensions.

DOMAIN-MATCHED KPI EXAMPLES:
  Sales:      SUM(Sales) | COUNT(Order ID) | AVG(Profit) | SUM(Quantity)
  HR:         COUNT(Employee ID) | AVG(Salary) | AVG(Tenure) | MAX(Salary)
  Healthcare: COUNT(Patient ID) | AVG(Age) | AVG(BMI) | SUM(Cost)
  Finance:    SUM(Amount) | AVG(Balance) | COUNT(Transactions) | MAX(Transaction)
  Marketing:  SUM(Spend) | AVG(CTR) | SUM(Conversions) | AVG(ROAS)
  Logistics:  COUNT(Shipments) | AVG(Lead Time) | SUM(Quantity) | AVG(Delivery Days)
  IoT:        COUNT(Readings) | AVG(Sensor Value) | MAX(Peak) | MIN(Floor)
  Generic:    COUNT rows | SUM of first numeric | AVG of second numeric | MAX of third numeric

━━━ STEP 4: CHART TYPE SELECTION ━━━

Generate exactly 4–7 charts total. Match dataset shape:

  Date + numeric + categorical  → kpi_card(s) + line(trend) + bar(by category) + donut(distribution)
  Date + numeric only           → kpi_card(s) + line + area + scatter(if 2+ numerics)
  Numeric + categorical         → kpi_card(s) + bar(top N) + donut + scatter(if 2+ numerics)
  Categorical only              → bar(count by cat1) + donut(count by cat2) + table
  Numeric only                  → kpi_card(s) + scatter(correlation) + table + gauge
  Very wide (>15 cols)          → Focus on the 4–6 most analytically relevant columns only
  Very sparse (<50 rows)        → table + kpi_card(s) + simple bar (avoid line/scatter)
  Survey/Likert                 → bar(response distribution) + donut(sentiment) + table
  Time-series/IoT               → line(primary metric) + area(secondary) + kpi_card(avg/latest)
  Geospatial                    → bar(top N locations) + donut(region split) + kpi_card

CHART CONSTRAINTS:
  ✗ NEVER generate scatter if fewer than 2 numeric columns exist
  ✗ NEVER generate line/area if there is no date or ordered sequence column
  ✓ ALWAYS include at least one bar, line, or area chart — never only KPI cards

━━━ STEP 5: FIELD MAPPING ━━━

x_field priority:
  1. Date/timestamp columns (for line/area)
  2. Low-cardinality string columns (unique_count < 50 ideal, < 200 acceptable)
  3. AVOID: ID columns, free-text (unique_count ≈ row_count)

y_field: numeric column with highest analytical relevance for the chart's purpose

top_n:
  → Bar charts over categorical dimensions: set top_n = 10 to 15
  → Line/area charts over dates: omit top_n (chronological order preserved)
  → Pie/donut: omit (slice limit applied automatically)

value_field: kpi_card ONLY — omit x_field/y_field when using value_field
Skip entirely: *_id, *_key, *_code, *_hash, *_uuid, row_number, index, Unnamed, unnamed

COLUMN NAMING INTELLIGENCE — detect intent from partial matches:
  date/time:  order_date, ship_date, created_at, timestamp, date, year, month, week
  revenue:    sales, revenue, amount, total, price, value, gmv, arr, mrr, ltv
  quantity:   qty, quantity, units, count, volume, num_, n_
  rate:       rate, ratio, pct, percent, %, score, index, efficiency, utilization
  geo:        city, country, state, region, zone, territory, postal, zip
  person:     customer, employee, user, patient, student, agent, rep, contact

━━━ STEP 6: INSIGHTS ━━━

Generate exactly 3 suggested_insights. Each must:
  1. Reference a specific column name or chart title
  2. State a concrete observation (%, rank, trend direction, outlier value)
  3. Explain what it means or what action it implies

Format: "[Column/metric] observation → analytical implication or recommended action"

━━━ OUTPUT FORMAT ━━━

Output ONLY valid JSON. No markdown fences, no explanation, no preamble.

{
  "dashboard_title": "Concise, specific title: dataset subject + primary finding",
  "theme": "dark_professional",
  "layout": "custom",
  "charts": [
    {
      "id": "chart_1",
      "type": "bar | line | area | pie | donut | scatter | kpi_card | table | funnel | gauge | heatmap",
      "title": "Specific descriptive title naming the metric and dimension",
      "x_field": "exact_column_name_from_schema",
      "y_field": "exact_column_name_from_schema",
      "value_field": "exact_column_name_from_schema (kpi_card only — omit x_field/y_field)",
      "aggregation": "sum | avg | count | max | min",
      "color": "#hexcolor",
      "top_n": 12,
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 }
    }
  ],
  "suggested_insights": ["insight 1 → implication", "insight 2 → implication", "insight 3 → implication"]
}

━━━ GRID LAYOUT (12-column canvas) ━━━

STRICT: Every row must fill exactly 12 column-width units. No gaps, no overflow.
No two charts may have overlapping (x, y, w, h) rectangles.

Row y=0, h=2 (KPI row):
  4 KPIs → w=3 each at x=0, 3, 6, 9
  3 KPIs → w=4 each at x=0, 4, 8
  2 KPIs → w=6 each at x=0, 6

Row y=2, h=5 (first chart row):
  2 charts → w=6+w=6  OR  w=8+w=4  OR  w=7+w=5
  1 chart  → w=12

Row y=7, h=5 (second chart row — if needed):
  Same rules. Total canvas height should not exceed y=12.

━━━ WORKFLOW ━━━

${fileCount > 1
  ? "1. Examine all schemas → if common column exists, call perform_join.\n2. Call validate_data_quality on the (merged) schema.\n3. Output the dashboard JSON."
  : "1. Call validate_data_quality.\n2. Output the dashboard JSON."
}`;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { files, userQuery, dashboardType } = await req.json();

    if (!userQuery || typeof userQuery !== "string" || !userQuery.trim()) {
      return NextResponse.json({ error: "userQuery is required" }, { status: 400 });
    }
    if (userQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: `userQuery too long (max ${MAX_QUERY_LENGTH} chars)` }, { status: 400 });
    }
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "files array is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const client       = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemPrompt = buildSystemPrompt(dashboardType || "auto", files.length);
    const tools        = files.length > 1 ? [JOIN_TOOL, VALIDATE_TOOL] : [VALIDATE_TOOL];

    // Build the user message — list every file's schema + sample rows
    const fileDescriptions = files.map((f: { fileName: string; schema: object; rows: object[] }, i: number) =>
      `File ${i + 1}: ${f.fileName}\nSchema:\n${JSON.stringify(f.schema, null, 2)}\n` +
      `Sample Rows (first ${DASHBOARD_SAMPLE_ROWS}):\n${JSON.stringify(f.rows.slice(0, DASHBOARD_SAMPLE_ROWS), null, 2)}`
    ).join("\n\n---\n\n");

    const userContent = `${fileDescriptions}\n\nUser Request: "${userQuery}"`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: "user", content: userContent }];
    let quality: object | null = null;
    let mergedData: any = null;
    let iterations = 0;
    const MAX_ITERATIONS = 8;  // guard against runaway tool loops

    // ── A2A agent loop ────────────────────────────────────────────────────────
    while (iterations++ < MAX_ITERATIONS) {
      const response = await client.messages.create({
        model:      process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6",
        max_tokens: MAX_CLAUDE_TOKENS,
        system:     systemPrompt,
        tools,
        messages,
      });

      // ── Token budget exhausted ───────────────────────────────────────────────
      if (response.stop_reason === "max_tokens") {
        throw new Error(
          "The dataset schema is too wide for the available token budget. " +
          "Try removing unused columns before uploading."
        );
      }

      if (response.stop_reason === "tool_use") {
        // Find all tool calls issued in this turn (Claude can call multiple tools at once)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolBlocks = response.content.filter((b: any) => b.type === "tool_use");
        
        // Append the assistant's request so the conversation history is valid
        messages.push({ role: "assistant", content: response.content });
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolResults: any[] = [];

        for (const toolBlock of toolBlocks as any[]) {
          if (toolBlock.name === "perform_join") {
            const joinResult = await executeJoinTool(
              toolBlock.input as { join_key: string; join_type: string; reasoning: string },
              files as { fileName: string; rows: object[] }[]
            );
            if (!joinResult.error) {
              mergedData = joinResult;
            }
            toolResults.push({
              type:        "tool_result",
              tool_use_id: toolBlock.id,
              content:     joinResult.error
                ? `Join failed: ${joinResult.error}`
                : JSON.stringify({
                    merged_schema:   joinResult.schema,
                    merged_rows:     (joinResult.rows || []).slice(0, 10),
                    join_stats:      joinResult.join_stats,
                  }),
            });
          } else if (toolBlock.name === "validate_data_quality") {
            quality = await executeValidationTool(
              toolBlock.input as { schema: object; sample_rows: object[] }
            );
            toolResults.push({
              type:        "tool_result",
              tool_use_id: toolBlock.id,
              content:     JSON.stringify(quality),
            });
          } else {
            // Unknown tool — don't loop forever
            throw new Error(`Claude invoked an unknown tool: ${toolBlock.name ?? "unknown"}`);
          }
        }

        // Return ALL tool results in the next user message
        messages.push({ role: "user", content: toolResults });

      } else {
        // end_turn — extract dashboard JSON
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawText: string = (response.content.find((b: any) => b.type === "text") as any)?.text ?? "";

        // Strip markdown fences before matching
        const cleaned = rawText.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          console.error("No JSON in Claude response (stop_reason:", response.stop_reason, "):", rawText.slice(0, 400));
          throw new Error("AI returned no valid JSON structure");
        }

        let dashboardSpec;
        try {
          dashboardSpec = JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error("AI returned malformed JSON — please try again");
        }

        if (!dashboardSpec.charts || !Array.isArray(dashboardSpec.charts)) {
          throw new Error("Invalid dashboard spec: missing charts array");
        }
        return NextResponse.json({ spec: dashboardSpec, quality, mergedData });
      }
    }

    throw new Error("Dashboard generation exceeded maximum retries. Please try a simpler query.");

  } catch (error) {
    const msg = (error as Error).message ?? "Unknown error";
    console.error("Dashboard generation error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
