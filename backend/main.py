from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import upload, validate, generate, analyze, eda, report

app = FastAPI(
    title="AnalyticsVisualAI API",
    description="Backend for the AnalyticsVisualAI dashboard platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, tags=["upload"])
app.include_router(validate.router, tags=["validate"])
app.include_router(generate.router, tags=["generate"])
app.include_router(analyze.router, tags=["analyze"])
app.include_router(eda.router, tags=["eda"])
app.include_router(report.router, tags=["report"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
async def root():
    return {"message": "AnalyticsVisualAI API — visit /docs for Swagger UI"}
