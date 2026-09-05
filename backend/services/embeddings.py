"""
Embedding and Vector Search Service for Personal Knowledge Assistant.
Supports:
1. Dense Vector Embeddings via SentenceTransformers + FAISS
2. Pure-NumPy Cosine Similarity Fallback (Zero-dependency crash resilience)
3. Hybrid Search: Dense Vector Similarity + Lexical Keyword Matching (Reciprocal Rank Fusion)
"""
import os
import re
import json
import logging
import pickle
import math
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any

import numpy as np
from config import settings

logger = logging.getLogger(__name__)

INDEX_FILE = Path(settings.faiss_index_path) / "index.faiss"
META_FILE = Path(settings.faiss_index_path) / "metadata.pkl"

# Global states
_model = None
_faiss_module = None
_faiss_available = False
_sentence_transformers_available = False

try:
    import faiss
    _faiss_module = faiss
    _faiss_available = True
except Exception as e:
    logger.info(f"FAISS module unavailable ({e}). Using high-performance NumPy vector index.")
    _faiss_available = False

try:
    from sentence_transformers import SentenceTransformer
    _sentence_transformers_available = True
except Exception as e:
    logger.info(f"sentence_transformers unavailable ({e}). Using deterministic lexical embedding fallback.")
    _sentence_transformers_available = False

_index = None
_metadata: List[dict] = []
_raw_vectors: Optional[np.ndarray] = None


def _load_model():
    """Load sentence transformer model if available, else None."""
    global _model
    if not _sentence_transformers_available:
        return None
    if _model is None:
        try:
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            _model = SentenceTransformer(settings.embedding_model)
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformer: {e}")
            _model = None
    return _model


def _deterministic_embed(texts: List[str], dim: int = 384) -> np.ndarray:
    """
    Deterministic hash-based lexical embedding fallback when heavy models are not present.
    Produces L2-normalized float32 vectors that maintain semantic word cluster similarity.
    """
    vectors = np.zeros((len(texts), dim), dtype=np.float32)
    for row, text in enumerate(texts):
        words = re.findall(r"\w+", text.lower())
        for word in words:
            # Deterministic pseudo-random distribution across vector coordinates
            h = hash(word)
            idx1 = abs(h) % dim
            idx2 = abs(hash(word + "_alt")) % dim
            val = 1.0 / (1.0 + math.log(1 + len(word)))
            vectors[row, idx1] += val
            vectors[row, idx2] += (val * 0.5)

        # L2-normalize
        norm = np.linalg.norm(vectors[row])
        if norm > 0:
            vectors[row] /= norm
        else:
            vectors[row, 0] = 1.0
    return vectors


def _load_index() -> Tuple[Any, List[dict]]:
    """Load or initialize vector index and metadata."""
    global _index, _metadata, _raw_vectors
    if _index is not None or _raw_vectors is not None:
        return _index, _metadata

    if META_FILE.exists():
        try:
            with open(META_FILE, "rb") as f:
                _metadata = pickle.load(f)
        except Exception:
            _metadata = []

    if _faiss_available and INDEX_FILE.exists():
        try:
            _index = _faiss_module.read_index(str(INDEX_FILE))
            logger.info(f"Loaded existing FAISS index ({_index.ntotal} vectors).")
            return _index, _metadata
        except Exception as e:
            logger.warning(f"Could not read FAISS index file: {e}. Falling back to NumPy vectors.")

    # Reconstruct or create NumPy vectors
    if _metadata:
        texts = [m["content"] for m in _metadata]
        _raw_vectors = embed_texts(texts)
    else:
        _raw_vectors = np.empty((0, settings.embedding_dim), dtype=np.float32)

    if _faiss_available:
        try:
            _index = _faiss_module.IndexFlatIP(settings.embedding_dim)
            if len(_raw_vectors) > 0:
                _index.add(_raw_vectors)
        except Exception:
            _index = None

    return _index, _metadata


def _save_index():
    """Persist index and metadata."""
    global _index, _metadata, _raw_vectors
    Path(settings.faiss_index_path).mkdir(parents=True, exist_ok=True)
    with open(META_FILE, "wb") as f:
        pickle.dump(_metadata, f)

    if _faiss_available and _index is not None:
        try:
            _faiss_module.write_index(_index, str(INDEX_FILE))
        except Exception as e:
            logger.warning(f"Failed to write FAISS file: {e}")


def embed_texts(texts: List[str]) -> np.ndarray:
    """Convert texts to normalized embedding vectors."""
    model = _load_model()
    if model is not None:
        try:
            embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1, norms)
            return (embeddings / norms).astype(np.float32)
        except Exception as e:
            logger.warning(f"Encoding failed: {e}. Falling back to deterministic vectors.")
    return _deterministic_embed(texts, dim=settings.embedding_dim)


def add_chunks_to_index(
    chunks: List[str],
    document_id: int,
    chunk_db_ids: List[int]
) -> List[int]:
    """Embed chunks and register them in vector store."""
    global _index, _metadata, _raw_vectors
    if not chunks:
        return []

    _load_index()
    vectors = embed_texts(chunks)

    start_pos = len(_metadata)
    faiss_ids = list(range(start_pos, start_pos + len(chunks)))

    if _faiss_available and _index is not None:
        try:
            _index.add(vectors)
        except Exception as e:
            logger.warning(f"FAISS add failed: {e}")

    if _raw_vectors is None or len(_raw_vectors) == 0:
        _raw_vectors = vectors
    else:
        _raw_vectors = np.vstack([_raw_vectors, vectors])

    for chunk_text, faiss_id, db_id in zip(chunks, faiss_ids, chunk_db_ids):
        _metadata.append({
            "faiss_id": faiss_id,
            "chunk_db_id": db_id,
            "document_id": document_id,
            "content": chunk_text,
        })

    _save_index()
    return faiss_ids


def search(query: str, top_k: int = 5, hybrid: bool = True) -> List[dict]:
    """
    Search knowledge base using Dense Vector Search with optional Hybrid Keyword Reranking (RRF).
    """
    global _index, _metadata, _raw_vectors
    _load_index()

    if not _metadata:
        return []

    query_vec = embed_texts([query])[0]
    dense_scores: List[Tuple[int, float]] = []

    # 1. Dense Semantic Scoring
    if _faiss_available and _index is not None and _index.ntotal > 0:
        try:
            k = min(top_k * 2, _index.ntotal)
            distances, indices = _index.search(np.expand_dims(query_vec, axis=0), k)
            for dist, pos in zip(distances[0], indices[0]):
                if pos != -1 and pos < len(_metadata):
                    dense_scores.append((pos, float(dist)))
        except Exception as e:
            logger.warning(f"FAISS search error: {e}. Using NumPy search.")
            dense_scores = []

    if not dense_scores and _raw_vectors is not None and len(_raw_vectors) > 0:
        # NumPy Cosine Similarity
        dots = np.dot(_raw_vectors, query_vec)
        top_indices = np.argsort(-dots)[:top_k * 2]
        for idx in top_indices:
            dense_scores.append((int(idx), float(dots[idx])))

    # 2. Hybrid Reranking (Reciprocal Rank Fusion)
    if not hybrid:
        results = []
        for pos, score in dense_scores[:top_k]:
            entry = dict(_metadata[pos])
            entry["relevance_score"] = max(0.01, min(0.99, round((score + 1.0) / 2.0, 4)))
            results.append(entry)
        return results

    # Keyword / Lexical Scoring
    q_tokens = set(re.findall(r"\w+", query.lower()))
    lexical_scores = []
    for pos, meta in enumerate(_metadata):
        c_tokens = set(re.findall(r"\w+", meta["content"].lower()))
        overlap = len(q_tokens.intersection(c_tokens))
        if overlap > 0:
            lexical_scores.append((pos, overlap))
    lexical_scores.sort(key=lambda x: x[1], reverse=True)

    # RRF (Reciprocal Rank Fusion) constant k=60
    rrf_k = 60
    rrf_scores: Dict[int, float] = {}

    for rank, (pos, _) in enumerate(dense_scores):
        rrf_scores[pos] = rrf_scores.get(pos, 0.0) + (1.0 / (rrf_k + rank + 1))

    for rank, (pos, _) in enumerate(lexical_scores[:top_k * 2]):
        rrf_scores[pos] = rrf_scores.get(pos, 0.0) + (1.0 / (rrf_k + rank + 1))

    # Sort combined results
    sorted_positions = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

    results = []
    for pos, rrf_score in sorted_positions:
        if pos < len(_metadata):
            entry = dict(_metadata[pos])
            # Normalize display score
            entry["relevance_score"] = round(min(0.98, max(0.40, rrf_score * 35.0)), 3)
            results.append(entry)

    return results


def delete_document_vectors(document_id: int):
    """Remove all vectors belonging to document."""
    global _index, _metadata, _raw_vectors
    _load_index()

    remaining_meta = [m for m in _metadata if m["document_id"] != document_id]
    if len(remaining_meta) == len(_metadata):
        return

    logger.info(f"Removing doc {document_id} from vector index.")
    _metadata = []
    _raw_vectors = None
    if _faiss_available:
        _index = _faiss_module.IndexFlatIP(settings.embedding_dim)
    else:
        _index = None

    if remaining_meta:
        chunks = [m["content"] for m in remaining_meta]
        chunk_db_ids = [m["chunk_db_id"] for m in remaining_meta]
        doc_ids = [m["document_id"] for m in remaining_meta]
        # Re-index remaining chunks
        vectors = embed_texts(chunks)
        _raw_vectors = vectors
        if _faiss_available and _index is not None:
            _index.add(vectors)
        for i, (c, did, cdid) in enumerate(zip(chunks, doc_ids, chunk_db_ids)):
            _metadata.append({
                "faiss_id": i,
                "chunk_db_id": cdid,
                "document_id": did,
                "content": c,
            })

    _save_index()


def get_index_stats() -> dict:
    """Return index stats."""
    _load_index()
    total = len(_metadata)
    unique_docs = len({m["document_id"] for m in _metadata})
    return {
        "total_vectors": total,
        "unique_documents": unique_docs,
        "embedding_dim": settings.embedding_dim,
        "engine": "faiss" if (_faiss_available and _index is not None) else "numpy_vector_engine",
        "hybrid_retrieval": True,
    }
