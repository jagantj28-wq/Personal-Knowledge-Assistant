"""
Document ingestion service — parses PDF, DOCX, TXT and web URLs,
then splits content into chunks ready for embedding.
"""
import re
import io
import logging
from pathlib import Path
from typing import List, Tuple

import httpx
import fitz  # PyMuPDF
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def chunk_text(text: str, max_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Split text into overlapping chunks by sentences to preserve context.
    """
    # Normalise whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Split into sentences (rough heuristic)
    sentences = re.split(r"(?<=[.!?])\s+", text)

    chunks: List[str] = []
    current_chunk = ""

    for sentence in sentences:
        # If a single sentence exceeds max_size, break it by words
        if len(sentence) > max_size:
            words = sentence.split()
            for word in words:
                if len(current_chunk) + len(word) + 1 > max_size:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = word
                else:
                    current_chunk += (" " + word) if current_chunk else word
        elif len(current_chunk) + len(sentence) + 1 > max_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # Add overlap from end of last chunk
            if overlap > 0 and chunks:
                last_words = chunks[-1].split()[-overlap // 5:]
                current_chunk = " ".join(last_words) + " " + sentence
            else:
                current_chunk = sentence
        else:
            current_chunk += (" " + sentence) if current_chunk else sentence

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return [c for c in chunks if len(c.strip()) > 20]


def parse_pdf(file_bytes: bytes) -> Tuple[str, int]:
    """
    Extract text from a PDF file.
    Returns (full_text, page_count).
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    texts = []
    for page_num, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            texts.append(f"[Page {page_num + 1}]\n{text}")
    return "\n\n".join(texts), len(doc)


def parse_txt(file_bytes: bytes) -> str:
    """Decode text file, trying UTF-8 then latin-1."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1")


def parse_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except ImportError:
        logger.warning("python-docx not installed; returning empty string for DOCX.")
        return ""


async def parse_url(url: str) -> Tuple[str, str]:
    """
    Fetch a web page and extract its main text content.
    Returns (title, clean_text).
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Extract title
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else url

    # Remove script/style elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Extract text from meaningful tags
    content_tags = soup.find_all(["p", "h1", "h2", "h3", "h4", "li", "article", "section"])
    text_parts = [tag.get_text(separator=" ", strip=True) for tag in content_tags]
    clean_text = "\n".join(text_parts)

    # Fallback: entire body text
    if len(clean_text) < 200:
        body = soup.find("body")
        clean_text = body.get_text(separator=" ", strip=True) if body else soup.get_text()

    return title, clean_text


def ingest_document(
    content: str,
    max_chunk_size: int = 500,
    chunk_overlap: int = 50
) -> List[str]:
    """
    Main ingestion entry point — returns list of text chunks.
    """
    chunks = chunk_text(content, max_size=max_chunk_size, overlap=chunk_overlap)
    logger.info(f"Ingested {len(chunks)} chunks from document.")
    return chunks
