import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import DocumentsPage from './pages/DocumentsPage'
import FlashcardsPage from './pages/FlashcardsPage'
import QuizPage from './pages/QuizPage'
import MindMapPage from './pages/MindMapPage'
import NotesPage from './pages/NotesPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-slate-900">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/flashcards" element={<FlashcardsPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/mindmap" element={<MindMapPage />} />
              <Route path="/notes" element={<NotesPage />} />
            </Routes>
          </main>
          <footer className="py-2.5 px-6 border-t border-slate-800 text-xs text-slate-400 bg-slate-900/95 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">Personal Knowledge Assistant</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-400">Hybrid RAG & SM-2</span>
            </div>
            <div className="font-medium text-slate-300">
              © 2026 <span className="text-blue-400 font-semibold">JAGAN T. JIJU</span>. All rights reserved.
            </div>
            <div className="text-slate-400">
              MIT License
            </div>
          </footer>
        </div>
      </div>
    </BrowserRouter>
  )
}
