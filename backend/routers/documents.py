"""
Documents router — upload files or URLs, list, delete documents.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from models.database import get_db, Document, DocumentChunk
from models.schemas import DocumentResponse, DocumentListResponse
from services.ingestion import parse_pdf, parse_txt, parse_docx, parse_url, ingest_document
from services.embeddings import add_chunks_to_index, delete_document_vectors
from services.gemini_service import summarize_document
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    tags: Optional[str] = Form(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF, TXT, or DOCX file and index it."""
    filename = file.filename or "untitled"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    file_bytes = await file.read()

    # Parse based on extension
    if ext == "pdf":
        raw_text, _ = parse_pdf(file_bytes)
        source_type = "pdf"
    elif ext == "docx":
        raw_text = parse_docx(file_bytes)
        source_type = "docx"
    else:
        raw_text = parse_txt(file_bytes)
        source_type = "txt"

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")

    return await _index_document(
        db=db,
        title=filename,
        raw_text=raw_text,
        source_type=source_type,
        source_path=filename,
        tags=tags or "",
    )


@router.post("/url", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def ingest_url(
    url: str = Form(...),
    tags: Optional[str] = Form(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Scrape a web URL and index its content."""
    try:
        title, raw_text = await parse_url(url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text content found at the URL.")

    return await _index_document(
        db=db,
        title=title,
        raw_text=raw_text,
        source_type="url",
        source_path=url,
        tags=tags or "",
    )


async def _index_document(
    db: AsyncSession,
    title: str,
    raw_text: str,
    source_type: str,
    source_path: str,
    tags: str,
) -> Document:
    """Shared logic: chunk, embed, store document."""
    chunks = ingest_document(raw_text, settings.max_chunk_size, settings.chunk_overlap)

    # Generate AI summary for preview
    try:
        preview = await summarize_document(raw_text, max_words=80)
    except Exception:
        preview = raw_text[:500]

    # Save document record
    doc = Document(
        title=title,
        source_type=source_type,
        source_path=source_path,
        content_preview=preview,
        total_chunks=len(chunks),
        total_tokens=len(raw_text.split()),
        tags=tags,
        is_indexed=False,
    )
    db.add(doc)
    await db.flush()  # get doc.id without committing

    # Save chunks to DB
    chunk_records = []
    for idx, chunk_text in enumerate(chunks):
        c = DocumentChunk(
            document_id=doc.id,
            chunk_index=idx,
            content=chunk_text,
        )
        db.add(c)
        chunk_records.append(c)

    await db.flush()  # get chunk IDs

    # Add to FAISS
    chunk_db_ids = [c.id for c in chunk_records]
    faiss_ids = add_chunks_to_index(chunks, doc.id, chunk_db_ids)

    # Update FAISS IDs on chunk records
    for chunk_record, faiss_id in zip(chunk_records, faiss_ids):
        chunk_record.faiss_index_id = faiss_id

    doc.is_indexed = True
    await db.commit()
    await db.refresh(doc)

    logger.info(f"Indexed document '{title}' ({len(chunks)} chunks).")
    return doc


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List all indexed documents."""
    result = await db.execute(
        select(Document).order_by(Document.created_at.desc()).offset(skip).limit(limit)
    )
    docs = result.scalars().all()
    count_result = await db.execute(select(func.count(Document.id)))
    total = count_result.scalar()
    return {"documents": docs, "total": total}


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove vectors from FAISS
    delete_document_vectors(document_id)

    # Delete from DB (cascades to chunks and flashcards)
    await db.delete(doc)
    await db.commit()
    logger.info(f"Deleted document {document_id}.")
