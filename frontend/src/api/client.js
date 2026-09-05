import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Documents ──────────────────────────────────────────────────────────────
export const documentsApi = {
  list: () => api.get('/documents/'),
  get: (id) => api.get(`/documents/${id}`),
  uploadFile: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadUrl: (formData) => api.post('/documents/url', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/documents/${id}`),
}

// ── Chat ────────────────────────────────────────────────────────────────────
export const chatApi = {
  sendMessage: (data) => api.post('/chat/message', data),
  listSessions: () => api.get('/chat/sessions'),
  getSessionMessages: (sessionId) => api.get(`/chat/sessions/${sessionId}/messages`),
  deleteSession: (sessionId) => api.delete(`/chat/sessions/${sessionId}`),
}

// ── Flashcards ──────────────────────────────────────────────────────────────
export const flashcardsApi = {
  list: (params) => api.get('/flashcards/', { params }),
  generate: (data) => api.post('/flashcards/generate', data),
  create: (data) => api.post('/flashcards/', data),
  review: (id, quality) => api.post(`/flashcards/${id}/review`, { quality }),
  delete: (id) => api.delete(`/flashcards/${id}`),
}

// ── Notes ────────────────────────────────────────────────────────────────────
export const notesApi = {
  list: () => api.get('/notes/'),
  get: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes/', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
}

// ── Mind Map ──────────────────────────────────────────────────────────────────
export const mindmapApi = {
  get: (documentId) => api.get('/mindmap/', { params: documentId ? { document_id: documentId } : {} }),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: () => api.get('/analytics/'),
}

// ── Quiz & Knowledge Evaluation ───────────────────────────────────────────────
export const quizApi = {
  generate: (data) => api.post('/quiz/generate', data),
  submit: (data) => api.post('/quiz/submit', data),
}

// ── Seed Demo Data ───────────────────────────────────────────────────────────
export const seedApi = {
  populate: () => api.post('/seed/'),
}

export default api
