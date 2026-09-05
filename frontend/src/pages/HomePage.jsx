import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Brain, FileText, CreditCard, MessageSquare, BookOpen,
  TrendingUp, Clock, Award, Sparkles, Database, Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { analyticsApi, seedApi } from '../api/client'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value ?? '—'}</p>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  const queryClient = useQueryClient()

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.get().then(r => r.data),
  })

  const seedMutation = useMutation({
    mutationFn: () => seedApi.populate(),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Sample knowledge base loaded!')
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['flashcards'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: () => toast.error('Failed to seed sample knowledge base.'),
  })

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Top Banner for Instant Evaluation */}
      {analytics?.total_documents === 0 && (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-purple-900/60 border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/40 border border-blue-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="text-blue-300" size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Prepare Instant Evaluation Demo</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Load sample academic documents (Transformers, Distributed Systems, Spaced Repetition) with 1 click.
              </p>
            </div>
          </div>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="btn-primary whitespace-nowrap flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold py-2.5 px-5 rounded-xl shadow-lg shadow-blue-950/50 transition-all"
          >
            {seedMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading Sample Data...
              </>
            ) : (
              <>
                <Database size={16} />
                Load Sample Knowledge Base
              </>
            )}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-1">
            Personal Knowledge Assistant 🧠
          </h1>
          <p className="text-slate-400 text-sm">
            AI-powered second brain: Hybrid RAG semantic search, SM-2 flashcards, knowledge graph, and AI quizzes.
          </p>
        </div>

        {analytics?.total_documents > 0 && (
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="btn-secondary text-xs flex items-center gap-2 py-2 self-start md:self-auto"
            title="Reload or verify sample documents"
          >
            <Database size={14} />
            {seedMutation.isPending ? 'Syncing...' : 'Reload Sample Data'}
          </button>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText} label="Documents" value={analytics?.total_documents} color="bg-blue-600" />
        <StatCard icon={CreditCard} label="Flashcards" value={analytics?.total_flashcards} color="bg-purple-600" />
        <StatCard icon={BookOpen} label="Notes" value={analytics?.total_notes} color="bg-emerald-600" />
        <StatCard icon={MessageSquare} label="Chat Sessions" value={analytics?.total_chat_sessions} color="bg-orange-600" />
      </div>

      {/* Cognitive & Learning Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className="text-yellow-400" />
            <h3 className="font-semibold text-slate-200">Due for Review</h3>
          </div>
          <p className="text-4xl font-bold text-yellow-400">{analytics?.flashcards_due_today ?? 0}</p>
          <p className="text-sm text-slate-400 mt-1">flashcards scheduled via SM-2</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-green-400" />
            <h3 className="font-semibold text-slate-200">Recall Accuracy</h3>
          </div>
          <p className="text-4xl font-bold text-green-400">{analytics?.average_flashcard_accuracy ?? 0}%</p>
          <p className="text-sm text-slate-400 mt-1">active recall retention rate</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-blue-400" />
            <h3 className="font-semibold text-slate-200">Indexed Vectors</h3>
          </div>
          <p className="text-4xl font-bold text-blue-400">{analytics?.total_chunks ?? 0}</p>
          <p className="text-sm text-slate-400 mt-1">hybrid embeddings searchable</p>
        </div>
      </div>

      {/* Top Tags */}
      {analytics?.most_used_tags?.length > 0 && (
        <div className="card mb-8">
          <h3 className="font-semibold text-slate-200 mb-3 text-sm">Active Knowledge Domains</h3>
          <div className="flex flex-wrap gap-2">
            {analytics.most_used_tags.map(({ tag, count }) => (
              <span key={tag} className="badge bg-blue-900/40 text-blue-300 border border-blue-700/50 text-xs">
                {tag} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Core Knowledge Engines</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { to: '/documents', icon: FileText, label: 'Documents', desc: 'PDF/TXT Ingestion', color: 'hover:border-blue-500' },
            { to: '/chat', icon: MessageSquare, label: 'RAG Chat', desc: 'Grounded Q&A', color: 'hover:border-purple-500' },
            { to: '/flashcards', icon: CreditCard, label: 'Flashcards', desc: 'SM-2 Spaced Repetition', color: 'hover:border-emerald-500' },
            { to: '/quiz', icon: Award, label: 'AI Quiz', desc: 'Knowledge Evaluation', color: 'hover:border-yellow-500' },
            { to: '/mindmap', icon: Brain, label: 'Mind Map', desc: 'Concept Graphs', color: 'hover:border-orange-500' },
          ].map(({ to, icon: Icon, label, desc, color }) => (
            <Link
              key={to}
              to={to}
              className={`card border border-slate-700 ${color} flex flex-col items-center text-center gap-2 py-5 px-3 transition-all duration-200 hover:scale-105 cursor-pointer`}
            >
              <Icon size={26} className="text-slate-200" />
              <span className="text-sm font-semibold text-slate-200">{label}</span>
              <span className="text-xs text-slate-400">{desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
