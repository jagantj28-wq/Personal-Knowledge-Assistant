"""
Mind Map router — extract concepts and build a knowledge graph.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import get_db, Document, DocumentChunk
from models.schemas import MindMapResponse, MindMapNode, MindMapEdge
from services.gemini_service import extract_concepts

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=MindMapResponse)
async def get_mindmap(
    document_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a mind map of concepts across all (or one specific) document(s).
    """
    if document_id:
        doc_result = await db.execute(select(Document).where(Document.id == document_id))
        docs = [doc_result.scalar_one_or_none()]
        if not docs[0]:
            raise HTTPException(status_code=404, detail="Document not found.")
    else:
        doc_result = await db.execute(select(Document).limit(10))
        docs = doc_result.scalars().all()

    if not docs:
        return MindMapResponse(nodes=[], edges=[])

    all_nodes: list[MindMapNode] = []
    all_edges: list[MindMapEdge] = []
    seen_concepts: set[str] = set()

    for doc in docs:
        if not doc:
            continue

        # Get document text
        chunk_result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.chunk_index)
            .limit(10)  # Use first 10 chunks to keep prompt manageable
        )
        chunks = chunk_result.scalars().all()
        text = " ".join(c.content for c in chunks)

        if not text.strip():
            continue

        # Extract concepts via Gemini
        try:
            result = await extract_concepts(text, max_concepts=15)
        except Exception as e:
            logger.warning(f"Concept extraction failed for doc {doc.id}: {e}")
            continue

        if not isinstance(result, dict):
            continue

        concepts: list[str] = result.get("concepts", [])
        relationships: list[dict] = result.get("relationships", [])

        # Add document node
        doc_node_id = f"doc_{doc.id}"
        all_nodes.append(MindMapNode(
            id=doc_node_id,
            label=doc.title[:40],
            type="document",
            document_id=doc.id,
        ))

        # Add concept nodes and edges from document
        for concept in concepts:
            concept_id = concept.lower().replace(" ", "_")[:50]
            if concept_id not in seen_concepts:
                all_nodes.append(MindMapNode(
                    id=concept_id,
                    label=concept,
                    type="concept",
                ))
                seen_concepts.add(concept_id)

            # Edge: document -> concept
            all_edges.append(MindMapEdge(
                id=f"{doc_node_id}_{concept_id}",
                source=doc_node_id,
                target=concept_id,
                label="contains",
            ))

        # Add relationship edges
        for rel in relationships:
            from_concept = str(rel.get("from", "")).lower().replace(" ", "_")[:50]
            to_concept = str(rel.get("to", "")).lower().replace(" ", "_")[:50]
            rel_type = str(rel.get("type", "related-to"))

            if from_concept and to_concept and from_concept in seen_concepts and to_concept in seen_concepts:
                edge_id = f"{from_concept}_{to_concept}"
                all_edges.append(MindMapEdge(
                    id=edge_id,
                    source=from_concept,
                    target=to_concept,
                    label=rel_type,
                ))

    return MindMapResponse(nodes=all_nodes, edges=all_edges)
