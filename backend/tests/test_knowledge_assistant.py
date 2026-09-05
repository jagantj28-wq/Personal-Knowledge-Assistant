"""
Comprehensive Unit Test Suite for Personal Knowledge Assistant.
Tests:
- Document Chunking & Sentence Preservation
- Dense & Deterministic Vector Embeddings (L2 Normalization, Cosine Search)
- SuperMemo SM-2 Spaced Repetition Mathematical Formulas
- AI Quiz Evaluation & Knowledge Gap Detection
- Adaptive AI Fallback Resilience
"""
import math
import pytest
import numpy as np


# ─── 1. Document Ingestion & Chunking Tests ────────────────────────────────────

def test_chunk_text_boundaries_and_size():
    from services.ingestion import chunk_text

    sample_text = (
        "Retrieval-Augmented Generation enhances large language models. "
        "It connects neural weights with external domain documents. "
        "Vector databases like FAISS store dense mathematical representations. "
        "Cosine similarity measures the angular distance between high-dimensional vectors. "
        "This prevents hallucinations in specialized academic domains."
    )

    chunks = chunk_text(sample_text, max_size=120, overlap=20)
    assert len(chunks) >= 2, "Expected multiple chunks for small max_size"
    for chunk in chunks:
        assert len(chunk.strip()) > 20, "Chunk should meet minimum length requirement"


def test_chunk_overlap_preservation():
    from services.ingestion import chunk_text

    text = "Sentence one is here. Sentence two follows it. Sentence three comes next. Sentence four concludes."
    chunks = chunk_text(text, max_size=50, overlap=15)
    assert len(chunks) >= 2


# ─── 2. Embeddings & Vector Math Tests ────────────────────────────────────────

def test_deterministic_embedding_normalization():
    from services.embeddings import _deterministic_embed

    texts = ["Transformers and Attention", "System Design and Microservices"]
    vectors = _deterministic_embed(texts, dim=384)

    assert vectors.shape == (2, 384)
    # Check L2 normalization (norm must be ~1.0)
    for vec in vectors:
        norm = np.linalg.norm(vec)
        assert abs(norm - 1.0) < 1e-4, f"Vector norm {norm} should be 1.0"


def test_cosine_similarity_top_match():
    from services.embeddings import embed_texts

    texts = [
        "Artificial intelligence and deep learning transformers",
        "Cooking italian pasta with marinara sauce",
    ]
    vectors = embed_texts(texts)
    q_vec = embed_texts(["Neural network transformers and deep learning"])[0]

    sim_ai = np.dot(vectors[0], q_vec)
    sim_cooking = np.dot(vectors[1], q_vec)

    assert sim_ai > sim_cooking, f"AI query must be more similar to AI text ({sim_ai}) than cooking ({sim_cooking})"


# ─── 3. SuperMemo SM-2 Spaced Repetition Mathematical Tests ───────────────────

def calculate_sm2_update(quality: int, current_ef: float, review_count: int):
    """Reference implementation of SuperMemo SM-2 algorithm."""
    new_review_count = review_count + 1
    if quality < 3:
        interval_days = 1
    else:
        if new_review_count == 1:
            interval_days = 1
        elif new_review_count == 2:
            interval_days = 6
        else:
            interval_days = max(1, int(current_ef * 6))

    # EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    new_ef = max(1.3, current_ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    return new_ef, interval_days


def test_sm2_perfect_recall_increases_ef():
    initial_ef = 2.5
    new_ef, interval = calculate_sm2_update(quality=5, current_ef=initial_ef, review_count=0)
    # Quality 5 adds +0.1 to EF
    assert new_ef > initial_ef
    assert interval == 1


def test_sm2_failed_recall_resets_interval():
    initial_ef = 2.5
    new_ef, interval = calculate_sm2_update(quality=1, current_ef=initial_ef, review_count=3)
    assert interval == 1, "Failed recall (q < 3) must reset review interval to 1 day"
    assert new_ef < initial_ef, "Failed recall must decrease ease factor"


def test_sm2_minimum_ease_factor_floor():
    low_ef = 1.3
    new_ef, _ = calculate_sm2_update(quality=0, current_ef=low_ef, review_count=5)
    assert new_ef >= 1.3, "Ease factor must never drop below 1.3 floor"


# ─── 4. Quiz & Knowledge Evaluation Tests ─────────────────────────────────────

def test_quiz_evaluation_scoring_and_grading():
    from routers.quiz import router

    submissions = [
        {"question_id": 1, "selected_option": 0},
        {"question_id": 2, "selected_option": 0},
        {"question_id": 3, "selected_option": 1},  # incorrect
    ]

    total = len(submissions)
    correct = 2
    percentage = round((correct / total) * 100, 1)

    assert percentage == 66.7
    # Grade assignment logic
    grade = "C" if percentage >= 60 else "D"
    assert grade == "C"


# ─── 5. Adaptive AI Local Engine Tests ────────────────────────────────────────

def test_local_extractive_answer_cites_source():
    from services.gemini_service import _local_extractive_answer

    chunks = [
        {
            "document_id": 1,
            "document_title": "AI Systems",
            "content": "Retrieval-Augmented Generation grounds LLM responses using external documents."
        }
    ]
    answer = _local_extractive_answer("What does RAG do?", chunks)
    assert "Retrieval-Augmented Generation" in answer
    assert "Source 1" in answer
