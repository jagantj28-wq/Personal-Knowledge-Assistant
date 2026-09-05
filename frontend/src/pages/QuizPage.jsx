import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Award, CheckCircle2, XCircle, HelpCircle, ArrowRight,
  RotateCcw, Sparkles, BookOpen, AlertTriangle, Loader2, Play
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { quizApi, documentsApi } from '../api/client'

export default function QuizPage() {
  const [selectedDocId, setSelectedDocId] = useState('')
  const [numQuestions, setNumQuestions] = useState(5)
  const [quizStarted, setQuizStarted] = useState(false)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [quizResult, setQuizResult] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(180)

  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => quizApi.generate({
      document_id: selectedDocId ? parseInt(selectedDocId) : null,
      num_questions: numQuestions,
    }),
    onSuccess: (res) => {
      if (!res.data || res.data.length === 0) {
        toast.error('No quiz questions could be generated. Please make sure documents are indexed.')
        return
      }
      setQuestions(res.data)
      setCurrentIndex(0)
      setSelectedAnswers({})
      setQuizResult(null)
      setQuizStarted(true)
      setSecondsLeft(numQuestions * 45)
      toast.success(`Generated ${res.data.length} assessment questions!`)
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || 'Failed to generate quiz.')
    },
  })

  const submitMutation = useMutation({
    mutationFn: (data) => quizApi.submit(data),
    onSuccess: (res) => {
      setQuizResult(res.data)
      toast.success(`Quiz evaluated! Score: ${res.data.score}/${res.data.total_questions}`)
    },
    onError: () => toast.error('Failed to submit quiz.'),
  })

  // Timer countdown
  useEffect(() => {
    if (!quizStarted || quizResult || secondsLeft <= 0) return
    const timer = setInterval(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(timer)
  }, [quizStarted, quizResult, secondsLeft])

  const handleSelectOption = (questionId, optionIdx) => {
    if (quizResult) return
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionIdx }))
  }

  const handleFinishQuiz = () => {
    const submissions = questions.map(q => ({
      question_id: q.id,
      selected_option: selectedAnswers[q.id] !== undefined ? selectedAnswers[q.id] : -1,
    }))
    submitMutation.mutate({
      document_id: selectedDocId ? parseInt(selectedDocId) : null,
      submissions,
    })
  }

  const handleReset = () => {
    setQuizStarted(false)
    setQuestions([])
    setSelectedAnswers({})
    setQuizResult(null)
  }

  const docs = docsData?.documents || []
  const currentQ = questions[currentIndex]
  const allAnswered = questions.length > 0 && questions.every(q => selectedAnswers[q.id] !== undefined)

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          <Award size={32} className="text-yellow-400" />
          AI Knowledge Evaluation & Quiz
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Evaluate your understanding with AI-generated assessment tests, citation verification, and knowledge gap analysis.
        </p>
      </div>

      {!quizStarted ? (
        /* Configuration Card */
        <div className="card max-w-2xl mx-auto p-8 border-slate-700 bg-slate-800/80">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
            <Sparkles size={22} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">Configure Your Knowledge Assessment</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select Source Document (or Entire Knowledge Base)
              </label>
              <select
                className="input w-full"
                value={selectedDocId}
                onChange={e => setSelectedDocId(e.target.value)}
              >
                <option value="">Whole Knowledge Base (Synthesized)</option>
                {docs.map(d => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Number of Questions
              </label>
              <div className="grid grid-cols-4 gap-3">
                {[3, 5, 10, 15].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumQuestions(n)}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      numQuestions === n
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/40'
                        : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {n} Questions
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 flex items-start gap-3">
              <BookOpen size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">
                The AI extracts core theoretical concepts, definitions, and technical formulas from your indexed documents.
                Each question includes rigorous distractors and detailed feedback.
              </p>
            </div>

            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base font-semibold shadow-lg shadow-blue-900/30"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Test Questions...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Start Knowledge Assessment
                </>
              )}
            </button>
          </div>
        </div>
      ) : quizResult ? (
        /* Results View */
        <div className="space-y-8 animate-slide-up">
          {/* Score Header Card */}
          <div className="card p-8 bg-slate-800 border-slate-700 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-900/40 border border-blue-500/40 mb-4">
              <span className="text-3xl font-extrabold text-blue-400">{quizResult.grade}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-100">
              {quizResult.passed ? '🎉 Assessment Passed!' : '📚 Review Needed'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              You scored <span className="font-bold text-slate-200">{quizResult.score}</span> out of{' '}
              <span className="font-bold text-slate-200">{quizResult.total_questions}</span> ({quizResult.percentage}%)
            </p>

            <div className="flex justify-center gap-3 mt-6">
              <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
                <RotateCcw size={15} /> Take Another Quiz
              </button>
            </div>
          </div>

          {/* Knowledge Gaps Analysis */}
          {quizResult.knowledge_gaps?.length > 0 && (
            <div className="card p-6 border-slate-700">
              <h3 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-yellow-400" />
                Knowledge Mastery & Gap Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizResult.knowledge_gaps.map((gap, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-200">{gap.topic}</span>
                      <span className={`badge text-xs ${gap.mastery_percentage >= 70 ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50' : 'bg-red-900/40 text-red-400 border border-red-700/50'}`}>
                        {gap.mastery_percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${gap.mastery_percentage >= 70 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${gap.mastery_percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400">{gap.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Breakdown */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-200">Question-by-Question Review</h3>
            {quizResult.detailed_feedback?.map((f, idx) => (
              <div
                key={idx}
                className={`card p-5 border-l-4 transition-all ${
                  f.is_correct ? 'border-l-emerald-500 bg-emerald-950/10' : 'border-l-red-500 bg-red-950/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {f.is_correct ? (
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Question {idx + 1} · {f.topic}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-100 mb-3 whitespace-pre-line">{f.question}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-3">
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                    <span className="text-slate-400">Your Answer: </span>
                    <span className={f.is_correct ? 'text-emerald-300 font-semibold' : 'text-red-400 font-semibold'}>
                      {f.selected_text}
                    </span>
                  </div>
                  {!f.is_correct && (
                    <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                      <span className="text-slate-400">Correct Answer: </span>
                      <span className="text-emerald-300 font-semibold">{f.correct_text}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-blue-400 font-medium">Explanation: </span>
                  {f.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Active Quiz Taking Mode */
        <div className="max-w-3xl mx-auto">
          {/* Progress & Timer Bar */}
          <div className="card mb-6 flex items-center justify-between py-3 px-5">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-300">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <div className="w-36 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>⏱️ {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
            </div>
          </div>

          {/* Current Question Card */}
          {currentQ && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-8 mb-6 border-slate-700 bg-slate-800"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="badge bg-blue-900/50 text-blue-300 border border-blue-700/50 text-xs">
                    {currentQ.topic || 'Concept'}
                  </span>
                  {currentQ.document_title && (
                    <span className="text-xs text-slate-400 truncate max-w-xs">
                      📖 {currentQ.document_title}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-medium text-slate-100 mb-6 leading-relaxed whitespace-pre-line">
                  {currentQ.question}
                </h3>

                <div className="space-y-3">
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = selectedAnswers[currentQ.id] === optIdx
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, optIdx)}
                        className={`w-full text-left p-4 rounded-xl border text-sm transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-blue-600/30 border-blue-500 text-slate-100 shadow-md'
                            : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-700/30'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="flex-1 leading-snug">{opt}</span>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="btn-secondary"
            >
              Previous
            </button>

            {currentIndex + 1 < questions.length ? (
              <button
                onClick={() => setCurrentIndex(i => i + 1)}
                className="btn-primary flex items-center gap-2"
              >
                Next <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleFinishQuiz}
                disabled={submitMutation.isPending}
                className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6"
              >
                {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Submit Assessment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
