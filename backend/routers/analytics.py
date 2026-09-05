"""
Analytics router — knowledge base usage statistics.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.database import get_db, Document, Flashcard, Note, ChatSession
from models.schemas import AnalyticsResponse

router = APIRouter()


@router.get("/", response_model=AnalyticsResponse)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    """Return aggregated analytics about the knowledge base."""
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar() or 0
    chunk_count = (await db.execute(
        select(func.sum(Document.total_chunks))
    )).scalar() or 0
    flashcard_count = (await db.execute(select(func.count(Flashcard.id)))).scalar() or 0
    note_count = (await db.execute(select(func.count(Note.id)))).scalar() or 0
    session_count = (await db.execute(select(func.count(ChatSession.id)))).scalar() or 0

    # Flashcards due today
    due_count = (await db.execute(
        select(func.count(Flashcard.id)).where(Flashcard.next_review_at <= datetime.utcnow())
    )).scalar() or 0

    # Average accuracy
    cards_result = await db.execute(
        select(Flashcard.review_count, Flashcard.correct_count).where(Flashcard.review_count > 0)
    )
    cards = cards_result.all()
    if cards:
        total_reviews = sum(r for r, _ in cards)
        total_correct = sum(c for _, c in cards)
        avg_accuracy = (total_correct / total_reviews * 100) if total_reviews > 0 else 0.0
    else:
        avg_accuracy = 0.0

    # Most used tags (from documents)
    docs_result = await db.execute(select(Document.tags))
    all_tags: dict[str, int] = {}
    for (tags_str,) in docs_result:
        for tag in (tags_str or "").split(","):
            tag = tag.strip()
            if tag:
                all_tags[tag] = all_tags.get(tag, 0) + 1
    most_used_tags = sorted(
        [{"tag": k, "count": v} for k, v in all_tags.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    return AnalyticsResponse(
        total_documents=doc_count,
        total_chunks=chunk_count,
        total_flashcards=flashcard_count,
        total_notes=note_count,
        total_chat_sessions=session_count,
        flashcards_due_today=due_count,
        average_flashcard_accuracy=round(avg_accuracy, 1),
        most_used_tags=most_used_tags,
    )
