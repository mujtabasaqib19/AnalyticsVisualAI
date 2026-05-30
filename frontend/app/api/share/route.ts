/**
 * /api/share — stateless share link encoding/decoding.
 *
 * POST { spec, rows } → { id }  — encodes dashboard state as base64url
 * GET  ?id=<token>   → { spec, rows }  — decodes back
 *
 * No database required. The "id" IS the encoded payload (≈1-6 KB base64url).
 * Share links look like: /share?d=<base64url>
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spec, rows } = body;

    if (!spec || !spec.charts) {
      return NextResponse.json({ error: "spec with charts required" }, { status: 400 });
    }

    // Encode up to 200 sample rows to keep URL manageable
    const payload = JSON.stringify({ spec, rows: (rows ?? []).slice(0, 200) });
    // btoa is available in Node 18+ / edge runtime
    const encoded = Buffer.from(payload).toString("base64url");

    return NextResponse.json({ id: encoded });
  } catch {
    return NextResponse.json({ error: "Encoding failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const decoded = Buffer.from(id, "base64url").toString("utf-8");
    const data = JSON.parse(decoded);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid or expired share link" }, { status: 400 });
  }
}
