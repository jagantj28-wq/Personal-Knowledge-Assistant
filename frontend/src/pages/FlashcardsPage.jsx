import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Plus, Trash2, Zap, ChevronLeft, ChevronRight, Check, X, Loader2, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { flashcardsApi, documentsApi } from '../api/client'

function FlashcardStudyMode({ cards, onExit }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [finished, setFinished] = useState(false)
  const queryClient = useQueryClient()

  const reviewMutation = useMutation({
    mutationFn: ({ id, quality }) => flashcardsApi.review(id, quality),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flashcards'] }),
  })

  const handleReview = (quality) => {
    reviewMutation.mutate({ id: cards[index].id, quality })
    setFlipped(false)
    if (index + 1 >= cards.length) {
      setFinished(true)
    } else {
      setIndex(i => i + 1)
    }
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-slate-100">Session Complete!</h2>
        <p className="text-slate-400">You reviewed {cards.length} flashcards.</p>
        <button onClick={onExit} className="btn-primary">Back to Cards</button>
      </div>
    )
  }

  const card = cards[index]
  const progress = ((index) / cards.length) * 100

  return (
    <div className="flex flex-col h-full p-8 max-w-2xl mx-auto w-full">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-sm">
          <ChevronLeft size={16} /> Exit
        </button>
        <span className="text-sm text-slate-400">{index + 1} / {cards.length}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full mb-8">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Card */}
      <div
        className="card flex-1 flex flex-col items-center justify-center cursor-pointer min-h-[280px] transition-all duration-200 hover:border-slate-500 select-none"
        onClick={() => setFlipped(f => !f)}
      >
        <div className="text-center px-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">
            {flipped ? 'Answer' : 'Question — click to reveal'}
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={flipped ? 'answer' : 'question'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-xl font-medium text-slate-100 leading-relaxed"
            >
              {flipped ? card.answer : card.question}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="mt-6 text-xs text-slate-600">Click card to flip</p>
      </div>

      {/* Review buttons */}
      {flipped && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3 mt-6 justify-center"
        >
          <button onClick={() => handleReview(0)} className="flex-1 bg-red-900/50 hover:bg-red-800 border border-red-700/50 text-red-300 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
            <X size={16} /> Again
          </button>
          <button onClick={() => handleReview(3)} className="flex-1 bg-yellow-900/50 hover:bg-yellow-800 border border-yellow-700/50 text-yellow-300 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
            <RotateCcw size={16} /> Hard
          </button>
          <button onClick={() => handleReview(5)} className="flex-1 bg-emerald-900/50 hover:bg-emerald-800 border border-emerald-700/50 text-emerald-300 py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
            <Check size={16} /> Easy
          </button>
        </motion.div>
      )}
    </div>
  )
}

export default function FlashcardsPage() {
  const [studyMode, setStudyMode] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState('')
  const [numCards, setNumCards] = useState(10)
  const queryClient = useQueryClient()

  const { data: flashcards = [], isLoading } = useQuery({
    queryKey: ['flashcards'],
    queryFn: () => flashcardsApi.list().then(r => r.data),
  })

  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => flashcardsApi.generate({
      document_id: parseInt(selectedDocId),
      num_cards: numCards,
      difficulty: 'medium',
      card_types: ['qa', 'definition'],
    }),
    onSuccess: (res) => {
      toast.success(`Generated ${res.data.length} flashcards!`)
      queryClient.invalidateQueries({ queryKey: ['flashcards'] })
    },
    onError: () => toast.error('Generation failed. Make sure a document is selected.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => flashcardsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flashcards'] }),
  })

  const docs = docsData?.documents || []
  const dueCards = flashcards.filter(c => !c.next_review_at || new Date(c.next_review_at) <= new Date())

  if (studyMode && dueCards.length > 0) {
    return <FlashcardStudyMode cards={dueCards} onExit={() => setStudyMode(false)} />
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Flashcards</h1>
          <p className="text-slate-400 text-sm mt-1">{flashcards.length} cards · {dueCards.length} due today</p>
        </div>
        {dueCards.length > 0 && (
          <button onClick={() => setStudyMode(true)} className="btn-primary flex items-center gap-2">
            <Zap size={16} /> Study Now ({dueCards.length})
          </button>
        )}
      </div>

      {/* Generator */}
      <div className="card mb-8">
        <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" /> AI Flashcard Generator
        </h2>
        <div className="flex flex-wrap gap-3">
          <select
            className="input flex-1 min-w-[200px]"
            value={selectedDocId}
            onChange={e => setSelectedDocId(e.target.value)}
          >
            <option value="">Select a document...</option>
            {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
          <select
            className="input w-32"
            value={numCards}
            onChange={e => setNumCards(parseInt(e.target.value))}
          >
            {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n} cards</option>)}
          </select>
          <button
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
            onClick={() => generateMutation.mutate()}
            disabled={!selectedDocId || generateMutation.isPending}
          >
            {generateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Generate
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      ) : flashcards.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
          <p>No flashcards yet. Generate some from a document!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {flashcards.map(card => (
            <div key={card.id} className="card group hover:border-slate-600 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-2">
                  <span className={`badge text-xs ${
                    card.difficulty === 'hard' ? 'bg-red-900/40 text-red-400 border border-red-800/50' :
                    card.difficulty === 'easy' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' :
                    'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50'
                  }`}>{card.difficulty}</span>
                  <span className="badge bg-slate-700 text-slate-400 text-xs">{card.card_type}</span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(card.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-sm font-medium text-slate-200 mb-2">{card.question}</p>
              <p className="text-xs text-slate-400 border-t border-slate-700 pt-2 mt-2">{card.answer}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                <span>{card.review_count} reviews</span>
                <span className="text-green-400">
                  {card.review_count > 0 ? `${Math.round((card.correct_count / card.review_count) * 100)}% correct` : 'Not reviewed'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
