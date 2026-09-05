# 🧠 Personal Knowledge Assistant (Second Brain AI)

<div align="center">

[![CI Pipeline](https://github.com/jagantj28-wq/Personal-Knowledge-Assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/jagantj28-wq/Personal-Knowledge-Assistant/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-green?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0%2B-646CFF?style=for-the-badge&logo=vite)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-1.5_Flash-4285F4?style=for-the-badge&logo=google)
![FAISS](https://img.shields.io/badge/FAISS-Vector_Search-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

**An academic and portfolio-grade multi-modal AI personal knowledge base and "Second Brain" combining Hybrid Retrieval-Augmented Generation (RAG), Cognitive Spaced Repetition (SuperMemo SM-2), Knowledge Graphs, and AI Assessment Quizzes.**

[Features](#-key-features) • [Academic Package](#-academic--viva-defense-package) • [Architecture](#-system-architecture) • [Quickstart](#-quickstart-guide) • [Evaluation Demo](#-instant-viva--evaluator-demo) • [API Docs](#-api-specification)

</div>

---

## ✨ Key Features

| Feature | Technical Description |
|---|---|
| 🔍 **Hybrid RAG Semantic Retrieval** | Combines dense 384-d vector embeddings (`all-MiniLM-L6-v2` + FAISS) with lexical keyword matching via **Reciprocal Rank Fusion (RRF)**. |
| 🛡️ **Adaptive AI Dual Engine** | Seamlessly connects to **Google Gemini 1.5 Flash / 2.0** when configured, and falls back to an **Intelligent Local Extractive Engine** when offline — guaranteeing 0% crash during presentations. |
| 🃏 **SuperMemo SM-2 Spaced Repetition** | Cognitive science-backed active recall algorithm dynamically adapting card review intervals ($I(n) = I(n-1) \times \text{EF}$) and ease factors based on recall quality (0–5). |
| 🎯 **AI Quiz & Knowledge Gap Analyzer** | Generates dynamic multiple-choice assessments from documents, evaluates student comprehension, assigns grades (A+ to D), and diagnoses topic-level knowledge gaps. |
| 🗺️ **Knowledge Graph Mind Map** | Interactive concept map (ReactFlow) visualizing relationships, entity co-occurrences, and cross-document concept linkages. |
| 📄 **Multi-Modal Document Ingestion** | Ingests PDF research papers, DOCX reports, Markdown, raw TXT, and cleans live web URLs with sentence-preserving sliding window chunking. |
| 📊 **Cognitive Learning Analytics** | Real-time tracking of review schedules, active recall retention rates, vector memory index statistics, and top domain tags. |
| ⚡ **One-Click Demo Seeder (`/api/seed`)** | Pre-loads academic knowledge bases (Transformers, System Design, Cognitive Psychology) with 1 click for instant presentation demos. |

---

## 🎓 Academic & Viva Defense Package

This repository includes a complete academic documentation and oral examination preparation kit:

- 📄 **[Academic Project Report](docs/PROJECT_REPORT.md)**: IEEE/ACM formatted project report with theoretical background, mathematical modeling, and performance metrics.
- 🎓 **[Viva Voce Q&A Cheat Sheet](docs/VIVA_QUESTIONS_AND_ANSWERS.md)**: Top 30 technical questions asked by professors & evaluators with comprehensive model answers.
- 🎯 **[5-Minute Live Presentation Script](docs/PRESENTATION_GUIDE.md)**: Click-by-click walkthrough for viva demonstrations.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER (React 18 + Vite)            │
│  - Dashboard & Analytics       - RAG Chat Interface                   │
│  - Document Ingestion Manager  - SM-2 Flashcard Study Engine           │
│  - AI Quiz & Gap Analyzer      - Knowledge Mind Map Canvas (ReactFlow) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST API (JSON / HTTP)
┌───────────────────────────────────▼────────────────────────────────────┐
│                        APPLICATION LAYER (FastAPI)                     │
│  ┌───────────────────────┐  ┌───────────────────┐  ┌────────────────┐ │
│  │   Document Router     │  │    Chat Router    │  │   Quiz Router  │ │
│  └───────────┬───────────┘  └─────────┬─────────┘  └────────┬───────┘ │
│  ┌───────────▼───────────┐  ┌─────────▼─────────┐  ┌────────▼───────┐ │
│  │ Ingestion & Chunking  │  │  Hybrid Search    │  │ SM-2 Scheduler │ │
│  │ (PyMuPDF / Sentence)  │  │ (Dense FAISS+RRF) │  │ Flashcards API │ │
│  └───────────┬───────────┘  └─────────┬─────────┘  └────────────────┘ │
│              │                        │                                │
│  ┌───────────▼────────────────────────▼──────────────────────────────┐ │
│  │               Adaptive AI Service (Dual Engine)                   │ │
│  │   [Primary]: Google Gemini 1.5 Flash / 2.0 API                    │ │
│  │   [Fallback]: Intelligent Offline Local Extractive NLP Engine     │ │
│  └────────────────────────────────────┬──────────────────────────────┘ │
└───────────────────────────────────────┼────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼────────────────────────────────┐
│                         DATA STORAGE LAYER                             │
│  - SQLite Database (Documents, Chunks, Flashcards, Notes, Chats)       │
│  - FAISS Vector Store (384-dimensional unit-normalized embeddings)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧮 Theoretical Formulations

### 1. Hybrid Retrieval: Reciprocal Rank Fusion (RRF)
To prevent vocabulary mismatch problems common in pure dense search, Hybrid RAG combines dense semantic vectors and lexical keyword ranks:
$$\text{RRF\_Score}(d) = \sum_{m \in \{\text{Dense}, \text{Lexical}\}} \frac{1}{k + \text{rank}_m(d)}, \quad k = 60$$

### 2. Cognitive Memory: SuperMemo SM-2 Formula
Ease factor $\text{EF}$ updates dynamically based on review recall quality $q \in \{0, 1, 2, 3, 4, 5\}$:
$$\text{EF}' = \max\left(1.3, \, \text{EF} + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))\right)$$
Interval progression:
$$I(1) = 1 \text{ day}, \quad I(2) = 6 \text{ days}, \quad I(n) = I(n-1) \times \text{EF}'$$
*(When recall fails ($q < 3$), the interval resets to 1 day for immediate re-learning).*

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- (Optional) Google Gemini API Key — [Get your free key here](https://aistudio.google.com/app/apikey)

### 1. Clone the Repository
```bash
git clone https://github.com/jagantj28-wq/Personal-Knowledge-Assistant.git
cd Personal-Knowledge-Assistant
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Optional: add your GEMINI_API_KEY in .env (if left blank, Local Fallback AI activates)

# Run verification test suite:
python run_tests.py

# Start FastAPI server:
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser 🚀

---

## ⚡ Instant Viva / Evaluator Demo

Want to demonstrate the system immediately without preparing PDFs?
1. Open the web app at `http://localhost:5173`.
2. Click the **"Load Sample Knowledge Base"** button on the Dashboard.
3. The system instantly indexes:
   - *Deep Learning & Transformer Architectures*
   - *Scalable Distributed System Design*
   - *Cognitive Psychology & Spaced Repetition*
4. Go to **AI Chat**, **Flashcards**, **AI Quiz**, or **Mind Map** for instant, rich interactive results!

---

## 📡 API Specification

Interactive Swagger / OpenAPI documentation is automatically available when running the backend:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/seed/` | 1-click sample knowledge base population |
| `POST` | `/api/documents/upload` | Upload & index PDF, DOCX, or TXT file |
| `POST` | `/api/documents/url` | Scrape & index web page URL |
| `POST` | `/api/chat/message` | Send question to RAG Q&A engine |
| `POST` | `/api/flashcards/generate` | Auto-generate study cards with AI |
| `POST` | `/api/flashcards/{id}/review` | Record SM-2 review score (0-5) |
| `POST` | `/api/quiz/generate` | Generate multiple-choice assessment |
| `POST` | `/api/quiz/submit` | Evaluate quiz and return knowledge gaps |
| `GET` | `/api/mindmap/` | Get concept graph nodes and edges |
| `GET` | `/api/analytics/` | Retrieve system & learning analytics |

---

## 🧪 Automated Testing

Run the test suite directly:
```bash
cd backend
python run_tests.py
```
Validates chunking boundaries, $L_2$ vector normalization, cosine top-match retrieval, SM-2 formula correctness, and quiz grading logic.

---

## 📄 License

This project is licensed under the MIT License — free for academic, personal, and research use.
