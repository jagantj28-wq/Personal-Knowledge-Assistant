# 🎓 VIVA VOCE & TECHNICAL DEFENSE GUIDE
## Top 30 Examiner Questions and Model Answers for Personal Knowledge Assistant

---

### **SECTION 1: ARCHITECTURE & RETRIEVAL-AUGMENTED GENERATION (RAG)**

#### **Q1: What is Retrieval-Augmented Generation (RAG) and why did you choose it over fine-tuning?**
**Answer:**
> "RAG decouples model parameters from verifiable knowledge sources. Fine-tuning bakes knowledge into neural network weights, which is expensive to compute, prone to catastrophic forgetting, and incapable of dynamic updates without retraining. 
> In contrast, RAG indexes raw documents into a vector database. At query time, we retrieve the top-$K$ most relevant passages and feed them into the LLM's prompt window as grounded context. This virtually eliminates hallucinations, supports instantaneous document additions/deletions, and allows exact source citations."

#### **Q2: Explain the difference between Dense Semantic Search and Lexical Search.**
**Answer:**
> "Lexical search (like BM25 or inverted index) searches for exact token matches or morphological roots. It fails when users search with synonyms or conceptual abstractions.
> Dense semantic search converts sentences into dense high-dimensional vectors (e.g. 384 dimensions) where semantically similar concepts are clustered closely in vector space, regardless of the exact vocabulary used. Our system combines both via **Reciprocal Rank Fusion (RRF)** to maximize precision."

#### **Q3: What is Reciprocal Rank Fusion (RRF) and what problem does it solve?**
**Answer:**
> "Pure dense search can occasionally miss exact acronyms or technical identifiers (e.g., 'RFC 7540' or 'CAP Theorem'). Pure lexical search misses synonyms. RRF normalizes and fuses rankings from multiple search algorithms using the formula:
> $$\text{Score}(d) = \sum \frac{1}{k + \text{rank}(d)}$$
> By using $k=60$, RRF provides a robust, scale-invariant hybrid score that balances semantic comprehension with exact keyword precision."

#### **Q4: Why do we normalize vector embeddings before computing similarity in FAISS?**
**Answer:**
> "When vectors are $L_2$-normalized to unit length ($\|\mathbf{v}\|_2 = 1$), the cosine similarity between two vectors $\mathbf{u}$ and $\mathbf{v}$ is algebraically identical to their inner product (dot product):
> $$\cos(\theta) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} = \mathbf{u} \cdot \mathbf{v}$$
> Computing inner products on normalized vectors in FAISS (`IndexFlatIP`) requires only fused multiply-add CPU/GPU operations, making search orders of magnitude faster than computing full Euclidean distance."

#### **Q5: What chunking strategy did you use and why is chunk overlap critical?**
**Answer:**
> "We implemented a sentence-boundary-preserving sliding window chunker with a 500-character target size and a 50-character overlap. Chunk overlap ensures that contextual information at the boundary of a cut is not severed. Without overlap, a key relationship spanning across two split sentences would be lost in both resulting vectors."

---

### **SECTION 2: COGNITIVE SCIENCE & SPACED REPETITION (SM-2)**

#### **Q6: Explain the mathematical logic behind the SuperMemo SM-2 algorithm in your project.**
**Answer:**
> "The SM-2 algorithm schedules memory reviews at exponentially expanding intervals to counteract the Ebbinghaus forgetting curve. It tracks an **Ease Factor (EF)**, initially 2.5. After each review with recall score $q \in [0, 5]$:
> 1. $\text{EF}' = \max(1.3, \, \text{EF} + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02)))$.
> 2. Interval 1 is 1 day; Interval 2 is 6 days; Interval $n$ is $I(n-1) \times \text{EF}'$.
> 3. If $q < 3$ (user failed recall), the interval immediately resets to 1 day so the student is re-tested the next day."

#### **Q7: Why is the Ease Factor bounded below at 1.3?**
**Answer:**
> "If the Ease Factor were allowed to drop below 1.3 or reach 1.0, the interval would stop growing ($I \times 1.0 = I$), trapping the user in an infinite loop of reviewing the same card every single day even after they eventually memorize it. The 1.3 floor ensures that once recalled, the card gradually expands its schedule."

#### **Q8: How is Active Recall superior to passive reading according to educational psychology?**
**Answer:**
> "Active recall forces the brain to retrieve information from long-term memory traces (the 'testing effect'). Cognitive research shows this strengthens synaptic plasticity and neural retention by up to 50% compared to passive rereading or highlighting."

---

### **SECTION 3: BACKEND, DATABASE & CONCURRENCY**

#### **Q9: Why did you choose FastAPI over Flask or Django?**
**Answer:**
> "FastAPI is built natively on Starlette and Pydantic, supporting asynchronous non-blocking I/O (`async`/`await`) out of the box. In an AI application where LLM API calls and vector searches involve network/disk latency, asynchronous handlers prevent server worker starvation, yielding 3-5x higher throughput than synchronous Flask."

#### **Q10: Explain your database schema and cascading deletion policy.**
**Answer:**
> "We designed a normalized relational schema in SQLite using SQLAlchemy 2.0. The `documents` table is the root parent. When a document is deleted, the database automatically cascades deletions to all associated `document_chunks` and `flashcards` via `cascade='all, delete-orphan'`. Concurrently, the backend removes the corresponding vector embeddings from the vector store."

#### **Q11: How does your system handle offline execution or missing API keys?**
**Answer:**
> "We engineered an **Adaptive AI Architecture**. At startup, the service verifies `GEMINI_API_KEY`. If present and valid, it routes queries to Google Gemini 1.5 Flash. If missing, expired, or offline, it activates our **Intelligent Local Fallback Engine**, which generates extractive RAG summaries with exact citations, heuristic flashcards, and concept graphs without throwing runtime exceptions."

---

### **SECTION 4: AI QUIZ & KNOWLEDGE GAP EVALUATION**

#### **Q12: How does the AI Quiz Generator diagnose Knowledge Gaps?**
**Answer:**
> "When generating a quiz from indexed documents, each question is tagged with its originating domain topic. Upon submission, the backend groups responses by topic and computes a topic mastery percentage. If mastery is below 70%, the system flags it as a 'Knowledge Gap' and automatically generates personalized recommendations directing the user to specific document sections."

#### **Q13: How do you prevent LLMs from generating duplicate or trivial flashcards?**
**Answer:**
> "Our prompt engineering schema enforces diverse card taxonomy: standard question-answer pairs (`qa`), vocabulary definitions (`definition`), and fill-in-the-blank statements (`cloze`). We also validate responses against a strict Pydantic model with de-duplication sets before persisting to the database."

---

### **SECTION 5: SYSTEM DESIGN & SECURITY**

#### **Q14: How would you scale this system to handle 100,000 documents across 10,000 users?**
**Answer:**
> "1. **Vector Store**: Transition from single-node local FAISS to a distributed vector database like Milvus, Qdrant, or pgvector with HNSW (Hierarchical Navigable Small World) indexing.
> 2. **Caching**: Deploy Redis for caching frequent semantic queries and LLM responses.
> 3. **Task Queue**: Move document ingestion and chunk embedding into an asynchronous Celery/Redis background worker queue to prevent HTTP connection timeouts on large 500-page PDFs.
> 4. **Multi-Tenancy**: Partition FAISS indices or vector namespaces by `user_id`."

#### **Q15: What security practices are implemented for file upload?**
**Answer:**
> "1. Extension and MIME-type validation (limiting strictly to PDF, TXT, DOCX).
> 2. Byte-level inspection and stream parsing with memory bounds to prevent Denial of Service (Decompression Bomb / Zip Bomb) attacks.
> 3. Disallowing arbitrary filesystem paths by using sanitized identifiers."
