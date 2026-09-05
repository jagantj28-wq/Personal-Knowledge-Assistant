import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Upload, Link, FileText, Trash2, Tag, Loader2, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentsApi } from '../api/client'

function DocumentCard({ doc, onDelete }) {
  return (
    <div className="card hover:border-slate-600 transition-all duration-200 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            doc.source_type === 'pdf' ? 'bg-red-900/50 text-red-400' :
            doc.source_type === 'url' ? 'bg-blue-900/50 text-blue-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            {doc.source_type === 'url' ? <Globe size={18} /> : <FileText size={18} />}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-slate-100 text-sm truncate">{doc.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{doc.total_chunks} chunks · {doc.total_tokens} tokens</p>
          </div>
        </div>
        <button
          onClick={() => onDelete(doc.id)}
          className="text-slate-500 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {doc.content_preview && (
        <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
          {doc.content_preview}
        </p>
      )}
      {doc.tags && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {doc.tags.split(',').filter(t => t.trim()).map(tag => (
            <span key={tag} className="badge bg-blue-900/40 text-blue-400 border border-blue-800/50">
              <Tag size={9} className="mr-1" />{tag.trim()}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <span className={`badge text-xs ${doc.is_indexed ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' : 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50'}`}>
          {doc.is_indexed ? '✓ Indexed' : '⏳ Indexing'}
        </span>
        <span className="badge bg-slate-700 text-slate-400 uppercase text-xs">{doc.source_type}</span>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [urlInput, setUrlInput] = useState('')
  const [tags, setTags] = useState('')
  const [activeTab, setActiveTab] = useState('file')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.list().then(r => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) => documentsApi.uploadFile(formData),
    onSuccess: () => {
      toast.success('Document uploaded and indexed!')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Upload failed.'),
  })

  const urlMutation = useMutation({
    mutationFn: (formData) => documentsApi.uploadUrl(formData),
    onSuccess: () => {
      toast.success('URL scraped and indexed!')
      setUrlInput('')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
    onError: (e) => toast.error(e?.response?.data?.detail || 'URL ingestion failed.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => documentsApi.delete(id),
    onSuccess: () => {
      toast.success('Document deleted.')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach(file => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tags', tags)
      uploadMutation.mutate(formData)
    })
  }, [tags, uploadMutation])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  })

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    const formData = new FormData()
    formData.append('url', urlInput)
    formData.append('tags', tags)
    urlMutation.mutate(formData)
  }

  const docs = data?.documents || []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">Documents</h1>
        <p className="text-slate-400 text-sm">Upload files or URLs to build your knowledge base.</p>
      </div>

      {/* Upload area */}
      <div className="card mb-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setActiveTab('file')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'file' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            <Upload size={14} className="inline mr-2" />File Upload
          </button>
          <button onClick={() => setActiveTab('url')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'url' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            <Link size={14} className="inline mr-2" />Web URL
          </button>
        </div>

        {/* Tags input */}
        <div className="mb-4">
          <input
            className="input"
            placeholder="Tags (comma-separated, optional)"
            value={tags}
            onChange={e => setTags(e.target.value)}
          />
        </div>

        {activeTab === 'file' ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragActive ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
            }`}
          >
            <input {...getInputProps()} />
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 size={32} className="animate-spin text-blue-400" />
                <p>Indexing document...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Upload size={32} className={isDragActive ? 'text-blue-400' : 'text-slate-500'} />
                <div>
                  <p className="font-medium text-slate-300">Drop files here or click to browse</p>
                  <p className="text-sm mt-1">Supports PDF, TXT, DOCX</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleUrlSubmit} className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="https://example.com/article"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              type="url"
            />
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={urlMutation.isPending}>
              {urlMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              Ingest
            </button>
          </form>
        )}
      </div>

      {/* Document list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-200">{docs.length} Documents</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FileText size={48} className="mx-auto mb-3 opacity-30" />
            <p>No documents yet. Upload your first one above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {docs.map(doc => (
              <DocumentCard key={doc.id} doc={doc} onDelete={id => deleteMutation.mutate(id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
