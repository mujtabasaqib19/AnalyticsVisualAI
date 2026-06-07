"""
Central configuration — all magic numbers live here.
Values can be overridden via environment variables.
"""
import os

# ── AI models ─────────────────────────────────────────────────────────────────
CLAUDE_MODEL    = os.getenv("CLAUDE_MODEL",  "claude-sonnet-4-6")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL",  "gemini-2.5-flash")
GEMINI_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)

# ── Timeouts (seconds) ────────────────────────────────────────────────────────
GEMINI_REPORT_TIMEOUT   = float(os.getenv("GEMINI_REPORT_TIMEOUT",   "60.0"))
GEMINI_VALIDATE_TIMEOUT = float(os.getenv("GEMINI_VALIDATE_TIMEOUT", "30.0"))
GEMINI_EDA_TIMEOUT      = float(os.getenv("GEMINI_EDA_TIMEOUT",      "120.0"))

# ── File upload ───────────────────────────────────────────────────────────────
MAX_FILE_SIZE_MB    = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# ── Claude generation ─────────────────────────────────────────────────────────
MAX_CLAUDE_TOKENS     = int(os.getenv("MAX_CLAUDE_TOKENS",     "8000"))
MAX_QUERY_LENGTH      = int(os.getenv("MAX_QUERY_LENGTH",      "5000"))
DASHBOARD_SAMPLE_ROWS = int(os.getenv("DASHBOARD_SAMPLE_ROWS", "10"))

# ── Data parsing ──────────────────────────────────────────────────────────────
SAMPLE_ROWS_HEAD     = int(os.getenv("SAMPLE_ROWS_HEAD",      "20"))
DATE_MATCH_THRESHOLD = float(os.getenv("DATE_MATCH_THRESHOLD", "0.6"))

# ── Quality scoring (mirrors frontend/lib/constants.ts) ──────────────────────
QUALITY_GOOD     = int(os.getenv("QUALITY_GOOD",     "80"))
QUALITY_MODERATE = int(os.getenv("QUALITY_MODERATE", "50"))
