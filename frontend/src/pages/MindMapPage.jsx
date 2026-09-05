import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Share2, Loader2, RefreshCw } from 'lucide-react'
import { mindmapApi } from '../api/client'
import { useEffect, useState } from 'react'

const nodeTypes = {
  document: ({ data }) => (
    <div className="px-4 py-2.5 bg-blue-700 border-2 border-blue-400 rounded-xl text-white text-xs font-semibold shadow-lg shadow-blue-900/30 max-w-[160px] text-center">
      📄 {data.label}
    </div>
  ),
  concept: ({ data }) => (
    <div className="px-3 py-2 bg-slate-700 border border-slate-500 rounded-lg text-slate-200 text-xs shadow max-w-[140px] text-center">
      {data.label}
    </div>
  ),
}

export default function MindMapPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mindmap'],
    queryFn: () => mindmapApi.get().then(r => r.data),
    enabled: true,
  })

  useEffect(() => {
    if (!data) return
    // Layout nodes in a force-like circular arrangement
    const docNodes = data.nodes.filter(n => n.type === 'document')
    const conceptNodes = data.nodes.filter(n => n.type !== 'document')

    const centerX = 500, centerY = 350
    const docRadius = 200
    const conceptRadius = 450

    const layoutNodes = [
      ...docNodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(docNodes.length, 1)
        return {
          id: n.id,
          type: 'document',
          position: {
            x: centerX + docRadius * Math.cos(angle),
            y: centerY + docRadius * Math.sin(angle),
          },
          data: { label: n.label },
        }
      }),
      ...conceptNodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(conceptNodes.length, 1)
        return {
          id: n.id,
          type: 'concept',
          position: {
            x: centerX + conceptRadius * Math.cos(angle),
            y: centerY + conceptRadius * Math.sin(angle),
          },
          data: { label: n.label },
        }
      }),
    ]

    const layoutEdges = data.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: { stroke: '#475569', strokeWidth: 1.5 },
      labelStyle: { fill: '#94a3b8', fontSize: 9 },
      animated: false,
      type: 'smoothstep',
    }))

    setNodes(layoutNodes)
    setEdges(layoutEdges)
  }, [data])

  const onConnect = useCallback(
    (params) => setEdges(eds => addEdge(params, eds)),
    [setEdges]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Share2 size={20} className="text-blue-400" /> Knowledge Mind Map
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">AI-generated concept graph across your documents</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-primary flex items-center gap-2"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Generate Map
        </button>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 relative">
        {nodes.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <Share2 size={56} className="mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-400">No mind map yet</p>
            <p className="text-sm mt-2">Click "Generate Map" to build a concept graph from your documents.</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-900"
          >
            <Background color="#334155" gap={24} />
            <Controls className="!bg-slate-800 !border-slate-700" />
            <MiniMap
              className="!bg-slate-800 !border-slate-700"
              nodeColor={(n) => n.type === 'document' ? '#2563eb' : '#475569'}
            />
          </ReactFlow>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <p>Extracting concepts with AI...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
