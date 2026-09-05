"""
Flashcards router — generate, review (spaced repetition), CRUD.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.database import get_db, Flashcard, Document, DocumentChunk
from models.schemas import (
    FlashcardCreate, FlashcardResponse,
    FlashcardGenerateRequest, FlashcardReviewRequest,
)
from services.gemini_service import generate_flashcards

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate", response_model=List[FlashcardResponse], status_code=status.HTTP_201_CREATED)
async def generate_flashcards_for_document(
    request: FlashcardGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate AI flashcards from a document and save them."""
    # Get document text from chunks
    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == request.document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    chunks = result.scalars().all()
    if not chunks:
        raise HTTPException(status_code=404, detail="Document not found or has no content.")

    full_text = " ".join(c.content for c in chunks)

    # Generate cards via Gemini
    raw_cards = await generate_flashcards(
        text=full_text,
        num_cards=request.num_cards,
        card_types=request.card_types,
        difficulty=request.difficulty,
    )

    if not raw_cards:
        raise HTTPException(status_code=500, detail="Flashcard generation returned no results.")

    saved_cards = []
    for card_data in raw_cards:
        card = Flashcard(
            document_id=request.document_id,
            question=card_data["question"],
            answer=card_data["answer"],
            card_type=card_data.get("card_type", "qa"),
            difficulty=card_data.get("difficulty", request.difficulty),
            next_review_at=datetime.utcnow(),
        )
        db.add(card)
        saved_cards.append(card)

    await db.commit()
    for card in saved_cards:
        await db.refresh(card)

    logger.info(f"Generated {len(saved_cards)} flashcards for document {request.document_id}.")
    return saved_cards


@router.get("/", response_model=List[FlashcardResponse])
async def list_flashcards(
    document_id: Optional[int] = None,
    due_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List flashcards, optionally filtered by document or due date."""
    query = select(Flashcard).order_by(Flashcard.created_at.desc())
    if document_id:
        query = query.where(Flashcard.document_id == document_id)
    if due_only:
        query = query.where(Flashcard.next_review_at <= datetime.utcnow())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=FlashcardResponse, status_code=status.HTTP_201_CREATED)
async def create_flashcard(card: FlashcardCreate, db: AsyncSession = Depends(get_db)):
    """Manually create a flashcard."""
    new_card = Flashcard(**card.model_dump(), next_review_at=datetime.utcnow())
    db.add(new_card)
    await db.commit()
    await db.refresh(new_card)
    return new_card


@router.post("/{card_id}/review", response_model=FlashcardResponse)
async def review_flashcard(
    card_id: int,
    review: FlashcardReviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Update a flashcard after a review using the SM-2 spaced repetition algorithm.
    quality: 0-5 (0=complete blackout, 5=perfect recall)
    """
    result = await db.execute(select(Flashcard).where(Flashcard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found.")

    q = review.quality
    card.review_count += 1
    card.last_reviewed_at = datetime.utcnow()

    if q >= 3:
        card.correct_count += 1

    # SM-2 interval calculation
    if q < 3:
        # Failed — reset
        interval_days = 1
    else:
        if card.review_count == 1:
            interval_days = 1
        elif card.review_count == 2:
            interval_days = 6
        else:
            # Estimate previous interval from ease factor
            interval_days = max(1, int(card.ease_factor))

    # Update ease factor
    card.ease_factor = max(1.3, card.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
    card.next_review_at = datetime.utcnow() + timedelta(days=interval_days)

    await db.commit()
    await db.refresh(card)
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flashcard(card_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flashcard).where(Flashcard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found.")
    await db.delete(card)
    await db.commit()
