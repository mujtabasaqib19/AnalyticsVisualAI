<div align="center">
  <img src="https://raw.githubusercontent.com/mujtabasaqib19/AnalyticsVisualAI/main/frontend/public/favicon.ico" width="80" alt="Logo" />
  <h1>AnalyticsVisualAI</h1>
  <p><strong>Agentic AI Platform for Autonomous Data Visualization & Analysis</strong></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688)](https://fastapi.tiangolo.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)](https://tailwindcss.com/)
  [![Claude 3.5 Sonnet](https://img.shields.io/badge/Claude-3.5_Sonnet-blue)](https://anthropic.com/)
  [![Gemini 1.5 Pro](https://img.shields.io/badge/Gemini-1.5_Pro-blue)](https://deepmind.google/technologies/gemini/)
</div>

<br />

## 🚀 Overview

**AnalyticsVisualAI** is an intelligent platform that instantly transforms raw datasets into interactive, highly customizable dashboards. Utilizing a multi-agent AI pipeline, it automates the tedious steps of data engineering, exploratory data analysis (EDA), layout planning, and narrative reporting—requiring absolute zero coding skills from the user.

Upload a CSV, type a query like *"Show me sales trends and geographic distribution"*, and watch the AI build a complete, interactive dashboard tailored to your data.

## ✨ Features

- **Autonomous EDA Engine**: Instantly profiles uploaded CSVs/Excel files, detecting data types, missing values, and generating smart bucketed aggregations.
- **Dual-AI Pipeline**: 
  - **Claude 3.5 Sonnet**: Analyzes schema and user intent to architect JSON dashboard specifications with optimal chart types and grid layouts.
  - **Gemini 1.5 Pro**: Evaluates data quality and dynamically authors professional, narrative PDF reports analyzing your dashboard insights.
- **Interactive Draggable Dashboards**: Fluid, responsive grid (via `react-grid-layout`) allowing users to drag, drop, resize, and reconfigure charts.
- **Theme Studio**: Custom aesthetic presets (Ocean, Sunset, Midnight, Cyber) applying dynamic color palettes and CSS variables across all components.
- **Multi-Format Export**: One-click generation of high-res PNGs, A4 PDFs, and AI-written Narrative Reports. Share dashboards instantly via encoded URL links.

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Framer Motion, Recharts, Zustand (State Management).
- **Backend**: Python, FastAPI, Pandas (EDA), Uvicorn.
- **AI Integration**: Anthropic SDK (Claude), Google GenAI SDK (Gemini).

## 💻 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/mujtabasaqib19/AnalyticsVisualAI.git
cd AnalyticsVisualAI
```

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
ANTHROPIC_API_KEY=your_claude_api_key
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start the Backend (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # On Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Start the Frontend (Next.js)
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` to start analyzing data!

## 🛡️ Privacy & Security
- **API Keys are Server-Side**: All LLM requests are proxied via secure backend or server-only Next.js routes. No keys are exposed to the client browser.
- **In-Memory Processing**: Data is processed in-memory during the session and is not persistently stored, ensuring confidentiality.

## 📄 License
This project is licensed under the MIT License.
