from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()                        # picks up .env from cwd (backend/)
load_dotenv(dotenv_path="../.env", override=True)   # also load from project root (analyticsvisualai/.env)


from routers import upload, validate, eda, report, join

app = FastAPI(
    title="AnalyticsVisualAI API",
    description="Backend for the AnalyticsVisualAI dashboard platform",
    version="1.0.0",
)

# Deduplicate origins in case FRONTEND_URL matches default
_origins = list({"http://localhost:3000", os.getenv("FRONTEND_URL", "http://localhost:3000")})
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active routes — called by the Next.js frontend
app.include_router(upload.router,   tags=["upload"])
app.include_router(validate.router, tags=["validate"])
app.include_router(eda.router,      tags=["eda"])
app.include_router(report.router,   tags=["report"])
app.include_router(join.router,     tags=["join"])
# NOTE: /generate and /orchestrate are handled by the Next.js API route
# (frontend/app/api/generate/route.ts) — backend equivalents removed.


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
async def root():
    return {"message": "AnalyticsVisualAI API — visit /docs for Swagger UI"}
