"""
Chat router — RAG-based conversational Q&A over the knowledge base.
"""
import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import get_db, ChatSession, ChatMessage, Document
from models.schemas import ChatMessageRequest, ChatMessageResponse, ChatSessionResponse, SourceChunk
from services.embeddings import search
from services.gemini_service import answer_question
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message to the AI assistant.
    Uses RAG: retrieves relevant chunks then calls Gemini.
    """
    # Get or create chat session
    if request.session_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == request.session_id))
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found.")
    else:
        session = ChatSession(title=request.message[:60])
        db.add(session)
        await db.flush()

    # Load recent chat history for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in reversed(history_result.scalars().all())
    ]

    # ── Semantic search for relevant chunks ──
    top_chunks = search(request.message, top_k=settings.top_k_results)

    # Enrich chunks with document titles
    source_chunks: List[SourceChunk] = []
    for chunk in top_chunks:
        doc_result = await db.execute(
            select(Document).where(Document.id == chunk["document_id"])
        )
        doc = doc_result.scalar_one_or_none()
        doc_title = doc.title if doc else f"Document {chunk['document_id']}"
        source_chunks.append(SourceChunk(
            document_id=chunk["document_id"],
            document_title=doc_title,
            chunk_content=chunk["content"],
            relevance_score=chunk["relevance_score"],
        ))

    # ── Generate AI response ──
    ai_answer = await answer_question(
        question=request.message,
        context_chunks=top_chunks,
        chat_history=history,
    )

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)

    # Save assistant message with sources
    sources_json = json.dumps([s.model_dump() for s in source_chunks])
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=ai_answer,
        sources=sources_json,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatMessageResponse(
        id=assistant_msg.id,
        session_id=session.id,
        role="assistant",
        content=ai_answer,
        sources=source_chunks,
        created_at=assistant_msg.created_at,
    )


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(50))
    sessions = result.scalars().all()
    output = []
    for s in sessions:
        count_result = await db.execute(
            select(ChatMessage).where(ChatMessage.session_id == s.id)
        )
        count = len(count_result.scalars().all())
        output.append(ChatSessionResponse(
            id=s.id,
            title=s.title,
            message_count=count,
            created_at=s.created_at,
        ))
    return output


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_session_messages(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    output = []
    for msg in messages:
        sources = []
        if msg.sources:
            try:
                sources = [SourceChunk(**s) for s in json.loads(msg.sources)]
            except Exception:
                pass
        output.append(ChatMessageResponse(
            id=msg.id,
            session_id=session_id,
            role=msg.role,
            content=msg.content,
            sources=sources,
            created_at=msg.created_at,
        ))
    return output


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    await db.delete(session)
    await db.commit()
    return {"message": "Session deleted."}
