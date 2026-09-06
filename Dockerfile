# ==============================================================================
# Multi-Stage Unified Dockerfile for Personal Knowledge Assistant
# Builds React/Vite frontend and serves entire app via FastAPI backend
# Compatible with Render, Docker, Railway, Fly.io, and Local Containers
# ==============================================================================

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend with Static Assets
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy built frontend assets from Stage 1 into static directory
COPY --from=frontend-builder /app/frontend/dist ./static

# Render / Cloud hosts dynamically provide PORT
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
