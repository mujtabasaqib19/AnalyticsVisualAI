import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface DashboardTheme {
  // Canvas background (CSS gradient or solid hex)
  canvasBg: string;
  // Card background
  cardBg: string;
  // Card border colour
  cardBorder: string;
  // Card header background
  cardHeaderBg: string;
  // Primary text on cards
  cardText: string;
  // Secondary / muted text
  cardTextMuted: string;
  // Ordered chart fill colours (6 minimum)
  chartColors: string[];
  // Grid-line colour in charts
  chartGrid: string;
  // Axis tick colour
  chartAxis: string;
  // Tooltip background
  tooltipBg: string;
  tooltipText: string;
  // Human-readable theme name
  name: string;
  // Short description
  description: string;
}

export interface ClaudeThemeAudit {
  approved: boolean;
  contrastIssues: string[];
  securityNotes: string[];
  suggestions: string[];
  overrides: Partial<DashboardTheme>;   // auto-fixed values
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/theme
// body: { prompt: string; currentTheme?: DashboardTheme }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { prompt, currentTheme } = await req.json() as {
      prompt: string;
      currentTheme?: DashboardTheme;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    // ── Step 1: Claude generates the theme ──────────────────────────────────
    const claudeSystem = `You are a world-class data visualization designer.
Your job is to generate a complete dashboard colour theme based on the user's description.

Return ONLY valid JSON matching this TypeScript type (no markdown fences):
{
  "canvasBg": string,        // CSS value: hex, rgb(), or linear-gradient(...)
  "cardBg": string,          // solid hex preferred
  "cardBorder": string,      // hex
  "cardHeaderBg": string,    // hex, slightly different from cardBg
  "cardText": string,        // hex — MUST have ≥4.5:1 contrast against cardBg
  "cardTextMuted": string,   // hex — MUST have ≥3:1 contrast against cardBg
  "chartColors": string[],   // exactly 8 hex codes, vivid and distinct
  "chartGrid": string,       // subtle hex
  "chartAxis": string,       // hex
  "tooltipBg": string,       // hex
  "tooltipText": string,     // hex — MUST contrast with tooltipBg
  "name": string,            // 2-4 word theme name
  "description": string      // one sentence
}

Rules:
- ALL hex values must be valid 6-digit hex codes (#rrggbb).
- canvasBg can be a CSS gradient string if the user asks for gradient backgrounds.
- Never use the same colour for text and its background.
- Ensure chart colours are distinct and work on the cardBg.`;

    const claudeMsg = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 1024,
      system: claudeSystem,
      messages: [
        {
          role: "user",
          content: currentTheme
            ? `Current theme for reference:\n${JSON.stringify(currentTheme, null, 2)}\n\nUser request: "${prompt}"`
            : `User request: "${prompt}"`,
        },
      ],
    });

    const raw = (claudeMsg.content[0] as { type: string; text: string }).text.trim();

    let theme: DashboardTheme;
    try {
      // Strip optional markdown fences
      const jsonStr = raw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
      theme = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Claude returned invalid JSON", raw }, { status: 500 });
    }

    // ── Step 2: Claude audits for visibility, integrity, security ───────────
    const auditSystem = `You are a UI security and accessibility auditor for data dashboards.
Review this dashboard colour theme JSON and return ONLY valid JSON (no markdown) matching:
{
  "approved": boolean,
  "contrastIssues": string[],   // WCAG contrast failures
  "securityNotes": string[],    // phishing-like patterns, deceptive colour usage, data-hiding risks
  "suggestions": string[],      // up to 3 short improvements
  "overrides": {}               // corrected values for ANY failing fields (same keys as theme)
}

Check:
1. WCAG AA contrast (≥4.5:1 for body text, ≥3:1 for large/muted text).
2. Chart colours must be distinguishable for colour-blind users.
3. No deceptive patterns (e.g. making negative values invisible by matching data colour to background).
4. tooltipText must contrast tooltipBg.
5. cardText and cardTextMuted must contrast cardBg.
If any field fails, add the corrected value to "overrides".`;

    const auditMsg = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 1024,
      system: auditSystem,
      messages: [
        {
          role: "user",
          content: `Theme to audit:\n${JSON.stringify(theme, null, 2)}`
        }
      ],
    });

    const auditRaw = (auditMsg.content[0] as { type: string; text: string }).text.trim();

    let audit: ClaudeThemeAudit = {
      approved: true,
      contrastIssues: [],
      securityNotes: [],
      suggestions: [],
      overrides: {},
    };

    try {
      const auditJson = auditRaw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
      audit = JSON.parse(auditJson);
    } catch {
      // Audit parse fail — use theme as-is
    }

    // Apply Gemini overrides onto the theme
    const finalTheme: DashboardTheme = { ...theme, ...audit.overrides };

    return NextResponse.json({ theme: finalTheme, audit });
  } catch (err) {
    console.error("[/api/theme]", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Theme generation failed" },
      { status: 500 }
    );
  }
}
