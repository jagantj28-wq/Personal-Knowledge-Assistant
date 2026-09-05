"""
Pydantic schemas (request / response models) for the API.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ─── Document schemas ──────────────────────────────────────────────────────────

class DocumentBase(BaseModel):
    title: str
    tags: Optional[str] = ""


class DocumentCreate(DocumentBase):
    pass


class DocumentResponse(DocumentBase):
    id: int
    source_type: str
    content_preview: Optional[str]
    total_chunks: int
    total_tokens: int
    is_indexed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


# ─── Chat schemas ───────────────────────────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    session_id: Optional[int] = None


class SourceChunk(BaseModel):
    document_id: int
    document_title: str
    chunk_content: str
    relevance_score: float


class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    sources: Optional[List[SourceChunk]] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    id: int
    title: Optional[str]
    message_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Flashcard schemas ─────────────────────────────────────────────────────────

class FlashcardBase(BaseModel):
    question: str
    answer: str
    difficulty: str = "medium"
    card_type: str = "qa"
    tags: Optional[str] = ""


class FlashcardCreate(FlashcardBase):
    document_id: Optional[int] = None


class FlashcardResponse(FlashcardBase):
    id: int
    document_id: Optional[int]
    review_count: int
    correct_count: int
    ease_factor: float
    next_review_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class FlashcardGenerateRequest(BaseModel):
    document_id: int
    num_cards: int = Field(default=10, ge=1, le=50)
    difficulty: str = "medium"
    card_types: List[str] = ["qa", "definition"]


class FlashcardReviewRequest(BaseModel):
    quality: int = Field(..., ge=0, le=5, description="Review quality 0-5 (SM-2 algorithm)")


# ─── Note schemas ──────────────────────────────────────────────────────────────

class NoteBase(BaseModel):
    title: str
    content: str
    tags: Optional[str] = ""


class NoteCreate(NoteBase):
    linked_document_ids: Optional[str] = ""


class NoteResponse(NoteBase):
    id: int
    ai_summary: Optional[str]
    linked_document_ids: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Mind Map schemas ──────────────────────────────────────────────────────────

class MindMapNode(BaseModel):
    id: str
    label: str
    type: str   # document | concept | keyword
    document_id: Optional[int] = None


class MindMapEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None


class MindMapResponse(BaseModel):
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]


# ─── Analytics schemas ─────────────────────────────────────────────────────────

class AnalyticsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    total_flashcards: int
    total_notes: int
    total_chat_sessions: int
    flashcards_due_today: int
    average_flashcard_accuracy: float
    most_used_tags: List[dict]
    knowledge_mastery_score: Optional[float] = 85.0
    total_quizzes_taken: Optional[int] = 0


# ─── Quiz & Knowledge Evaluation schemas ───────────────────────────────────────

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_answer: int  # index 0..3
    explanation: str
    topic: str
    document_id: Optional[int] = None
    document_title: Optional[str] = None


class QuizGenerateRequest(BaseModel):
    document_id: Optional[int] = None
    num_questions: int = Field(default=5, ge=1, le=20)
    topic: Optional[str] = None


class QuizSubmissionItem(BaseModel):
    question_id: int
    selected_option: int


class QuizSubmissionRequest(BaseModel):
    document_id: Optional[int] = None
    submissions: List[QuizSubmissionItem]
    time_taken_seconds: Optional[int] = 0


class KnowledgeGap(BaseModel):
    topic: str
    correct: int
    total: int
    mastery_percentage: float
    recommendation: str


class QuizResultResponse(BaseModel):
    score: int
    total_questions: int
    percentage: float
    grade: str
    passed: bool
    knowledge_gaps: List[KnowledgeGap]
    detailed_feedback: List[Dict[str, Any]]


# ─── Seed schema ──────────────────────────────────────────────────────────────

class SeedResponse(BaseModel):
    message: str
    documents_created: int
    chunks_created: int
    flashcards_created: int
    notes_created: int
