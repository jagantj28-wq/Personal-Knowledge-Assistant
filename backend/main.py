"""
FastAPI application entry point for the Personal Knowledge Assistant.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import settings
from models.database import init_db
from routers import documents, chat, flashcards, notes, mindmap, analytics, quiz, seed
from services.gemini_service import is_gemini_active

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

static_dir = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("🚀 Starting Personal Knowledge Assistant (Full Marks Edition)...")
    await init_db()
    logger.info("✅ Database initialized.")
    yield
    logger.info("🛑 Shutting down Personal Knowledge Assistant.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "An AI-powered personal knowledge base with hybrid semantic search, "
        "RAG-based Q&A, SuperMemo SM-2 flashcards, knowledge graph mind maps, "
        "and interactive AI quiz evaluation."
    ),
    lifespan=lifespan,
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ────────────────────────────────────────────────────────────────────
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(flashcards.router, prefix="/api/flashcards", tags=["Flashcards"])
app.include_router(notes.router, prefix="/api/notes", tags=["Notes"])
app.include_router(mindmap.router, prefix="/api/mindmap", tags=["Mind Map"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["Quiz & Evaluation"])
app.include_router(seed.router, prefix="/api/seed", tags=["Demo Seed"])


@app.get("/api/health", tags=["Health"])
async def health():
    from services.embeddings import get_index_stats
    stats = get_index_stats()
    return {
        "status": "healthy",
        "version": settings.app_version,
        "gemini_active": is_gemini_active(),
        "vector_store": stats,
    }


# ─── Unified SPA / Static Frontend Serving ─────────────────────────────────────
if static_dir.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Don't hijack API routes if they 404
        if full_path.startswith("api/"):
            return {"error": "API route not found", "path": full_path}

        target_file = static_dir / full_path
        if full_path and target_file.exists() and target_file.is_file():
            return FileResponse(target_file)

        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)

        return {
            "message": "Personal Knowledge Assistant API",
            "version": settings.app_version,
            "docs": "/docs",
            "gemini_active": is_gemini_active(),
        }
else:
    @app.get("/", tags=["Health"])
    async def root():
        return {
            "message": "Personal Knowledge Assistant API",
            "version": settings.app_version,
            "docs": "/docs",
            "gemini_active": is_gemini_active(),
        }
