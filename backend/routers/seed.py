"""
Seed Router — Populates rich demo data for instant viva/presentation evaluation.
"""
from datetime import datetime, timedelta
import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import get_db, Document, DocumentChunk, Flashcard, Note, ChatSession, ChatMessage
from models.schemas import SeedResponse
from services.ingestion import ingest_document
from services.embeddings import add_chunks_to_index
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

SAMPLE_DOCUMENTS = [
    {
        "title": "Deep Learning & Transformer Architectures",
        "tags": "AI, Deep Learning, Transformers, NLP",
        "content": """
Transformers are deep learning architectures introduced in the landmark 2017 paper 'Attention Is All You Need' by Vaswani et al.
Unlike recurrent neural networks (RNNs) that process sequential data step-by-step, Transformers process entire input sequences simultaneously using self-attention mechanisms.

The Self-Attention Mechanism computes attention weights between every pair of tokens in a sequence:
Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V
where Q represents Queries, K represents Keys, and V represents Values. The scaling factor sqrt(d_k) prevents dot products from growing excessively large in high dimensions.

Multi-Head Attention extends this by projecting queries, keys, and values into multiple subspace representations in parallel.
This enables the model to simultaneously attend to information from different representation subspaces at different positions.

Positional Encodings are injected into input embeddings to provide token order information, since the attention mechanism is permutation invariant.
Modern LLMs, including GPT-4, Gemini, and Claude, rely on decoder-only or encoder-decoder Transformer foundations.

Retrieval-Augmented Generation (RAG) connects LLMs to external vector databases.
RAG reduces hallucinations by retrieving authoritative domain documents and injecting them as context into the model's prompt.
        """.strip(),
    },
    {
        "title": "Scalable Distributed System Design",
        "tags": "System Design, Microservices, Databases, Cloud",
        "content": """
Distributed systems consist of autonomous computing nodes that communicate over a network to achieve common goals.
The CAP Theorem, formulated by Eric Brewer, states that a distributed data store can simultaneously provide at most two of three guarantees:
Consistency (every read receives the most recent write or an error), Availability (every non-failing request receives a non-error response), and Partition Tolerance (system continues to operate despite arbitrary message loss or network partitions).

In the presence of network partitions (P), distributed systems must trade off between Consistency (CP systems like ZooKeeper, HBase) and Availability (AP systems like Cassandra, DynamoDB).

Microservice Architecture decomposes monolithic applications into loosely coupled, independently deployable services organized around business capabilities.
Services communicate synchronously via REST/gRPC or asynchronously through event streaming platforms like Apache Kafka or RabbitMQ.

Caching strategies improve latency and throughput:
1. Cache-Aside: Application reads from cache; on miss, reads from database and populates cache.
2. Write-Through: Data is written to cache and database simultaneously.
3. Write-Behind (Write-Back): Data is written to cache first and asynchronously flushed to the database.

Database Sharding horizontally partitions large datasets across independent database instances using consistent hashing keys.
        """.strip(),
    },
    {
        "title": "Cognitive Psychology & Spaced Repetition",
        "tags": "Cognitive Science, Spaced Repetition, Learning, Memory",
        "content": """
Human memory retention exhibits exponential decay over time, a phenomenon first modeled mathematically by Hermann Ebbinghaus in 1885 as the Forgetting Curve:
R = e^(-t / S)
where R is memory retention, t is time elapsed, and S is the relative strength of the memory trace.

Active Recall is the cognitive practice of stimulating memory during the learning process by testing oneself rather than passively rereading material.
Research demonstrates that active retrieval creates stronger neural pathways and significantly improves long-term knowledge retention.

The SuperMemo SM-2 Algorithm, developed by Piotr Wozniak, optimizes spacing intervals based on user feedback quality q (0 to 5):
The Ease Factor (EF) adjusts dynamically after every review:
EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
The minimum allowed Ease Factor is 1.3 to prevent stagnation.

The Spacing Intervals (I) are computed as:
Interval I(1) = 1 day
Interval I(2) = 6 days
Interval I(n) = I(n - 1) * EF
When recall fails (quality < 3), the review interval resets to 1 day, ensuring difficult items are reviewed more frequently until mastered.
        """.strip(),
    },
]


@router.post("/", response_model=SeedResponse, status_code=status.HTTP_201_CREATED)
async def seed_demo_knowledge_base(db: AsyncSession = Depends(get_db)):
    """
    Pre-populate the database with 3 academic documents, vector embeddings,
    smart flashcards, and notes for instant live demonstrations.
    """
    # Check if documents already seeded
    existing = await db.execute(select(Document))
    if len(existing.scalars().all()) > 0:
        return SeedResponse(
            message="Knowledge base already contains data. Ready for testing!",
            documents_created=0,
            chunks_created=0,
            flashcards_created=0,
            notes_created=0,
        )

    doc_count = 0
    total_chunk_count = 0
    flashcard_count = 0

    for doc_spec in SAMPLE_DOCUMENTS:
        chunks = ingest_document(doc_spec["content"], max_chunk_size=400, chunk_overlap=40)
        doc = Document(
            title=doc_spec["title"],
            source_type="txt",
            source_path="sample_data/" + doc_spec["title"].lower().replace(" ", "_") + ".txt",
            content_preview=doc_spec["content"][:300] + "...",
            total_chunks=len(chunks),
            total_tokens=len(doc_spec["content"].split()),
            tags=doc_spec["tags"],
            is_indexed=True,
        )
        db.add(doc)
        await db.flush()
        doc_count += 1

        chunk_records = []
        for idx, chunk_text in enumerate(chunks):
            c = DocumentChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=chunk_text,
            )
            db.add(c)
            chunk_records.append(c)

        await db.flush()
        total_chunk_count += len(chunk_records)

        # Add to vector store
        chunk_db_ids = [c.id for c in chunk_records]
        faiss_ids = add_chunks_to_index(chunks, doc.id, chunk_db_ids)

        for chunk_record, faiss_id in zip(chunk_records, faiss_ids):
            chunk_record.faiss_index_id = faiss_id

    # Create Seed Flashcards
    sample_cards = [
        ("What is the Attention formula in Transformers?", "Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V", "hard", "qa", 1),
        ("Why is the sqrt(d_k) scaling factor used in self-attention?", "It prevents dot products from growing too large in high dimensions, preventing small softmax gradients.", "medium", "qa", 1),
        ("What is the CAP Theorem?", "A distributed system can guarantee at most two of Consistency, Availability, and Partition Tolerance.", "medium", "qa", 2),
        ("Explain the Cache-Aside pattern.", "The application checks the cache first; on a miss, reads from the database and writes the result to cache.", "easy", "definition", 2),
        ("What is the Ebbinghaus Forgetting Curve formula?", "R = e^(-t / S), showing exponential memory decay over time.", "medium", "qa", 3),
        ("What is the minimum ease factor in the SM-2 algorithm?", "1.3, ensuring items never enter an infinite difficult loop.", "easy", "definition", 3),
        ("What is Retrieval-Augmented Generation (RAG)?", "Grounding LLM prompts with relevant external documents retrieved from a vector index.", "easy", "definition", 1),
    ]

    for q, a, diff, ctype, doc_offset in sample_cards:
        fc = Flashcard(
            document_id=doc_offset,
            question=q,
            answer=a,
            difficulty=diff,
            card_type=ctype,
            ease_factor=2.5,
            review_count=1,
            correct_count=1,
            next_review_at=datetime.utcnow() - timedelta(hours=2),  # Due today
        )
        db.add(fc)
        flashcard_count += 1

    # Create Seed Notes
    sample_notes = [
        ("Key takeaways on RAG Systems", "Retrieval-Augmented Generation bridges static LLM weights with real-time enterprise databases. Vector databases like FAISS enable low-latency semantic search using cosine similarity.", "AI, RAG, Architecture"),
        ("Distributed Consistency Models", "When designing microservices, decide early whether you need strong consistency (CP) or eventual consistency (AP) under network partition constraints.", "Architecture, Systems"),
    ]

    for title, content, tags in sample_notes:
        note = Note(
            title=title,
            content=content,
            tags=tags,
            ai_summary=content[:100] + "...",
        )
        db.add(note)

    # Create Initial Chat Session
    session = ChatSession(title="Introduction to Knowledge Base")
    db.add(session)
    await db.flush()

    msg_u = ChatMessage(session_id=session.id, role="user", content="How does the SM-2 spaced repetition algorithm work?")
    msg_a = ChatMessage(
        session_id=session.id,
        role="assistant",
        content="The **SuperMemo SM-2 algorithm** optimizes recall by scheduling reviews at expanding intervals:\n\n- First interval: 1 day\n- Second interval: 6 days\n- Subsequent intervals: `Interval(n) = Interval(n-1) * Ease Factor`\n\nThe **Ease Factor (EF)** adjusts dynamically from 1.3 to 2.5+ based on your self-reported recall score (0 to 5). [Source: Cognitive Psychology & Spaced Repetition]",
    )
    db.add(msg_u)
    db.add(msg_a)

    await db.commit()
    logger.info("✅ Successfully seeded demo knowledge base.")

    return SeedResponse(
        message="Demo knowledge base seeded successfully with academic topics, flashcards, notes, and chat history!",
        documents_created=doc_count,
        chunks_created=total_chunk_count,
        flashcards_created=flashcard_count,
        notes_created=len(sample_notes),
    )
