# AnalyticsVisualAI — Quick Start

## Prerequisites
- Node.js 20+
- Python 3.11+
- API keys: Anthropic (required) + Google Gemini (optional)

---

## 1. Set up environment variables

```bash
cp .env.example frontend/.env.local
cp .env.example backend/.env
```

Edit both files and add your API keys:
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com/
- `GEMINI_API_KEY` — from https://aistudio.google.com/ (optional, falls back to rule-based quality check)

---

## 2. Start the Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
Swagger UI: http://localhost:8000/docs

---

## 3. Start the Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

---

## 4. Use the App

1. Open http://localhost:3000
2. Click **Upload Your Data** → drop a CSV/Excel file
3. Select dashboard type (Sales / HR / Finance / General)
4. Type what you want to see (e.g. "Show monthly revenue by region")
5. Click **Generate Dashboard with Claude + Gemini**
6. Your interactive dashboard appears in ~5–10 seconds

---

## Demo CSV to test with

Create a file `test_sales.csv`:
```csv
month,region,revenue,units_sold,sales_rep
Jan,North,45000,120,Alice
Feb,North,52000,140,Alice
Jan,South,38000,95,Bob
Feb,South,41000,105,Bob
Jan,East,29000,78,Carol
Feb,East,33000,88,Carol
Mar,North,61000,165,Alice
Mar,South,47000,118,Bob
Mar,East,39000,102,Carol
```

Query: "Show me monthly revenue by region as a bar chart with a KPI for total revenue"

---

## Architecture

```
User → Next.js (port 3000) → [Claude API via /api/generate route]
                           → [FastAPI (port 8000) → Gemini validation]
```

The Next.js app calls Claude directly via server-side API route (`/api/generate`).
The FastAPI backend handles file parsing and Gemini validation.
