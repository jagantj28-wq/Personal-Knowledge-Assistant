"""
Notes router — create, read, update, delete notes with AI summarization.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import get_db, Note
from models.schemas import NoteCreate, NoteResponse
from services.gemini_service import summarize_note

router = APIRouter()


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(note: NoteCreate, db: AsyncSession = Depends(get_db)):
    """Create a note with an auto-generated AI summary."""
    ai_summary = await summarize_note(note.content)
    new_note = Note(
        title=note.title,
        content=note.content,
        tags=note.tags,
        ai_summary=ai_summary,
        linked_document_ids=note.linked_document_ids or "",
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)
    return new_note


@router.get("/", response_model=List[NoteResponse])
async def list_notes(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Note).order_by(Note.updated_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: int, note_data: NoteCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")

    note.title = note_data.title
    note.content = note_data.content
    note.tags = note_data.tags
    note.linked_document_ids = note_data.linked_document_ids or ""
    note.ai_summary = await summarize_note(note_data.content)

    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    await db.delete(note)
    await db.commit()
