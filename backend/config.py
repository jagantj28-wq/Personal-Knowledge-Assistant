"""
Configuration settings for the Personal Knowledge Assistant backend.
Reads from environment variables / .env file.
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Google Gemini
    gemini_api_key: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./knowledge_assistant.db"

    # FAISS vector store
    faiss_index_path: str = "./faiss_index"

    # Embedding model (Sentence Transformers)
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dim: int = 384  # dimension for all-MiniLM-L6-v2

    # Text chunking
    max_chunk_size: int = 500
    chunk_overlap: int = 50

    # RAG retrieval
    top_k_results: int = 5

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # App info
    app_name: str = "Personal Knowledge Assistant"
    app_version: str = "1.0.0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()

# Ensure FAISS index directory exists
Path(settings.faiss_index_path).mkdir(parents=True, exist_ok=True)
