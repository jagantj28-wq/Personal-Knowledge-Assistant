import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Send, Bot, User, BookOpen, Plus, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { chatApi } from '../api/client'
import toast from 'react-hot-toast'

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-blue-600' : 'bg-purple-700'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-sm'
        }`}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {/* Sources */}
        {message.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((src, i) => (
              <span key={i} className="badge bg-slate-800 border border-slate-600 text-slate-400 text-xs gap-1">
                <BookOpen size={10} />
                {src.document_title?.substring(0, 25) ?? 'Source'}
                <span className="text-blue-400">({(src.relevance_score * 100).toFixed(0)}%)</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => chatApi.listSessions().then(r => r.data),
  })

  const sendMutation = useMutation({
    mutationFn: ({ message, session_id }) => chatApi.sendMessage({ message, session_id }),
    onSuccess: (res) => {
      const data = res.data
      setSessionId(data.session_id)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content,
        sources: data.sources,
      }])
      refetchSessions()
    },
    onError: () => toast.error('Failed to get response. Check your API key and try again.'),
  })

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return
    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    sendMutation.mutate({ message: input, session_id: sessionId })
    setInput('')
  }

  const handleNewChat = () => {
    setSessionId(null)
    setMessages([])
  }

  const loadSession = async (sid) => {
    const res = await chatApi.getSessionMessages(sid)
    setSessionId(sid)
    setMessages(res.data)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <button onClick={handleNewChat} className="btn-secondary w-full flex items-center gap-2 justify-center text-sm">
            <Plus size={14} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions?.map(s => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-700 transition-colors truncate ${
                sessionId === s.id ? 'bg-slate-700' : ''
              }`}
            >
              {s.title || `Session ${s.id}`}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-blue-900/40 rounded-2xl flex items-center justify-center mb-4">
                <Bot size={32} className="text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-200 mb-2">Ask your Knowledge Base</h2>
              <p className="text-slate-400 max-w-md text-sm">
                Upload documents first, then ask questions. The AI will search your knowledge base and answer with citations.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
          )}
          {sendMutation.isPending && (
            <div className="flex gap-3 animate-slide-up">
              <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center">
                <Bot size={14} />
              </div>
              <div className="card flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 size={14} className="animate-spin" /> Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="Ask a question about your documents..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="btn-primary px-4"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
