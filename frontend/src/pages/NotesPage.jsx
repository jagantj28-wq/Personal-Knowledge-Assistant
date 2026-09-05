import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Trash2, Edit3, Save, X, Loader2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { notesApi } from '../api/client'

function NoteCard({ note, onDelete, onEdit }) {
  return (
    <div className="card hover:border-slate-600 transition-all group animate-fade-in">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-slate-100 text-sm leading-tight">{note.title}</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onEdit(note)} className="text-slate-400 hover:text-blue-400 p-1 transition-colors">
            <Edit3 size={13} />
          </button>
          <button onClick={() => onDelete(note.id)} className="text-slate-400 hover:text-red-400 p-1 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {note.ai_summary && (
        <div className="flex items-start gap-2 mb-3 bg-blue-900/20 border border-blue-800/30 rounded-lg p-2.5">
          <Sparkles size={12} className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-300 leading-relaxed">{note.ai_summary}</p>
        </div>
      )}
      <div className="text-xs text-slate-400 line-clamp-3 leading-relaxed prose prose-invert prose-xs max-w-none">
        <ReactMarkdown>{note.content.substring(0, 200)}</ReactMarkdown>
      </div>
      {note.tags && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {note.tags.split(',').filter(t => t.trim()).map(tag => (
            <span key={tag} className="badge bg-slate-700 text-slate-400 text-xs">{tag.trim()}</span>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-600 mt-3">
        {new Date(note.updated_at).toLocaleDateString()}
      </p>
    </div>
  )
}

function NoteEditor({ note, onSave, onClose }) {
  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [tags, setTags] = useState(note?.tags || '')

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="font-semibold text-slate-100">{note ? 'Edit Note' : 'New Note'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 flex-1">
          <input
            className="input"
            placeholder="Note title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="input h-48 resize-none"
            placeholder="Write your note here... (Markdown supported)"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <input
            className="input"
            placeholder="Tags (comma-separated)"
            value={tags}
            onChange={e => setTags(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSave({ title, content, tags })}
            className="btn-primary flex items-center gap-2"
            disabled={!title.trim() || !content.trim()}
          >
            <Save size={14} /> Save Note
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [showEditor, setShowEditor] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const queryClient = useQueryClient()

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => notesApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => notesApi.create(data),
    onSuccess: () => {
      toast.success('Note created with AI summary!')
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      setShowEditor(false)
    },
    onError: () => toast.error('Failed to create note.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => notesApi.update(id, data),
    onSuccess: () => {
      toast.success('Note updated!')
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setShowEditor(false)
      setEditingNote(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => notesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  const handleSave = (data) => {
    if (editingNote) {
      updateMutation.mutate({ id: editingNote.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (note) => {
    setEditingNote(note)
    setShowEditor(true)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Notes</h1>
          <p className="text-slate-400 text-sm mt-1">AI-summarized notes with Markdown support</p>
        </div>
        <button
          onClick={() => { setEditingNote(null); setShowEditor(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> New Note
        </button>
      </div>

      {(createMutation.isPending || updateMutation.isPending) && (
        <div className="card mb-4 flex items-center gap-3 text-slate-400">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <span className="text-sm">AI is generating a summary...</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>No notes yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={(id) => deleteMutation.mutate(id)}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {showEditor && (
        <NoteEditor
          note={editingNote}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setEditingNote(null) }}
        />
      )}
    </div>
  )
}
