import { NavLink } from 'react-router-dom'
import {
  Brain, MessageSquare, FileText, CreditCard, Share2, BookOpen, Home, Zap, Award
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/flashcards', icon: CreditCard, label: 'Flashcards' },
  { to: '/quiz', icon: Award, label: 'AI Quiz' },
  { to: '/mindmap', icon: Share2, label: 'Mind Map' },
  { to: '/notes', icon: BookOpen, label: 'Notes' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm leading-tight">Personal</h1>
            <h1 className="font-bold text-blue-400 text-sm leading-tight">Knowledge AI</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Zap size={12} className="text-yellow-400" />
          <span>Gemini & Hybrid RAG</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium">
          © 2026 JAGAN T. JIJU
        </p>
      </div>
    </aside>
  )
}
