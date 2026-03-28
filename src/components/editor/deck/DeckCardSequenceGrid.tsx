"use client"

import Link from "next/link"
import { useEffect, useMemo } from "react"
import {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "reactflow"
import "reactflow/dist/style.css"
import { updateOption } from "@/app/actions"
import { DeckCard } from "@/components/editor/deck/types"

type SequenceNodeData = {
  id: string
  title: string
  type: string
  description: string
  conditions: { id: string; type: string; key: string }[]
  options: { id: string; text: string }[]
  gameId: string
}

function SequenceNode({ data }: NodeProps<SequenceNodeData>) {
  const optionGap = 26

  return (
    <div className="relative w-[320px] rounded-lg border border-slate-600 bg-slate-900/90 p-3 shadow-lg">
      <Handle type="target" position={Position.Left} className="h-2 w-2 border border-slate-300 bg-slate-400" />

      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-100">{data.title}</p>
        <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
          {data.type}
        </span>
      </div>

      <p className="line-clamp-2 text-xs text-slate-300">{data.description || "Sin descripcion"}</p>
      <div className="mt-2 text-[11px] text-slate-400">
        Condiciones: {data.conditions.length} · Opciones: {data.options.length}
      </div>

      {data.conditions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.conditions.slice(0, 3).map((condition) => (
            <span
              key={condition.id}
              className="rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-200"
            >
              {condition.type}:{condition.key}
            </span>
          ))}
          {data.conditions.length > 3 && (
            <span className="rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-200">
              +{data.conditions.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1">
        {data.options.map((option, index) => (
          <div key={option.id} className="rounded bg-slate-700/70 px-2 py-1 text-xs text-slate-200">
            {index + 1}. {option.text || "Sin texto"}
          </div>
        ))}
      </div>

      <Link
        href={`/editor/${data.gameId}/cards/${data.id}`}
        className="mt-2 inline-block text-xs font-semibold text-blue-300 hover:text-blue-200"
      >
        Abrir carta
      </Link>

      {data.options.map((option, index) => (
        <Handle
          key={option.id}
          id={`opt-${option.id}`}
          type="source"
          position={Position.Right}
          style={{ top: 74 + index * optionGap }}
          className="h-2 w-2 border border-slate-200 bg-blue-400"
        />
      ))}
    </div>
  )
}

const nodeTypes = {
  sequenceCard: SequenceNode,
}

function buildLevels(cards: DeckCard[]) {
  const incomingCount = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  cards.forEach((card) => {
    incomingCount.set(card.id, 0)
    adjacency.set(card.id, [])
  })

  cards.forEach((card) => {
    card.options.forEach((option) => {
      if (!option.nextCardId || !incomingCount.has(option.nextCardId)) return
      incomingCount.set(option.nextCardId, (incomingCount.get(option.nextCardId) || 0) + 1)
      adjacency.set(card.id, [...(adjacency.get(card.id) || []), option.nextCardId])
    })
  })

  const queue: string[] = []
  const levelById = new Map<string, number>()

  cards.forEach((card) => {
    if ((incomingCount.get(card.id) || 0) === 0) {
      queue.push(card.id)
      levelById.set(card.id, 1)
    }
  })

  while (queue.length > 0) {
    const current = queue.shift() as string
    const level = levelById.get(current) || 1

    ;(adjacency.get(current) || []).forEach((nextId) => {
      const prev = levelById.get(nextId) || 1
      if (level + 1 > prev) {
        levelById.set(nextId, level + 1)
      }

      const remaining = (incomingCount.get(nextId) || 1) - 1
      incomingCount.set(nextId, remaining)
      if (remaining <= 0) {
        queue.push(nextId)
      }
    })
  }

  cards.forEach((card) => {
    if (!levelById.has(card.id)) {
      levelById.set(card.id, 1)
    }
  })

  return levelById
}

export default function DeckCardSequenceGrid({
  cards,
  gameId,
  deckId,
}: {
  cards: DeckCard[]
  gameId: string
  deckId: string
}) {
  const levelById = useMemo(() => buildLevels(cards), [cards])

  const initialData = useMemo(() => {
    const cardsByLevel = new Map<number, DeckCard[]>()
    cards.forEach((card) => {
      const level = levelById.get(card.id) || 1
      cardsByLevel.set(level, [...(cardsByLevel.get(level) || []), card])
    })

    const initialNodes: Node<SequenceNodeData>[] = []
    const initialEdges: Edge[] = []

    Array.from(cardsByLevel.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([level, levelCards]) => {
        levelCards.forEach((card, index) => {
          initialNodes.push({
            id: card.id,
            type: "sequenceCard",
            position: { x: (level - 1) * 380, y: index * 250 },
            draggable: true,
            data: {
              id: card.id,
              title: card.title,
              type: card.type,
              description: card.description,
              gameId,
              conditions: card.conditions.map((condition) => ({
                id: condition.id,
                type: condition.type,
                key: condition.key,
              })),
              options: card.options.map((option) => ({ id: option.id, text: option.text })),
            },
          })
        })
      })

    cards.forEach((card) => {
      card.options.forEach((option, index) => {
        if (!option.nextCardId) return

        initialEdges.push({
          id: `edge-${option.id}`,
          source: card.id,
          target: option.nextCardId,
          sourceHandle: `opt-${option.id}`,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#94a3b8",
          },
          label: option.text || `Opcion ${index + 1}`,
          labelStyle: {
            fill: "#cbd5e1",
            fontSize: 10,
          },
          style: {
            stroke: "#64748b",
            strokeWidth: 1.6,
          },
        })
      })
    })

    return { initialNodes, initialEdges }
  }, [cards, gameId, levelById])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.initialEdges)

  useEffect(() => {
    setNodes(initialData.initialNodes)
    setEdges(initialData.initialEdges)
  }, [initialData, setEdges, setNodes])

  async function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target || !connection.sourceHandle) return

    const optionId = connection.sourceHandle.replace("opt-", "")
    const sourceCard = cards.find((card) => card.id === connection.source)
    const sourceOption = sourceCard?.options.find((option) => option.id === optionId)

    if (!sourceOption) return

    setEdges((prev) => {
      const filtered = prev.filter((edge) => edge.id !== `edge-${optionId}`)
      return addEdge(
        {
          id: `edge-${optionId}`,
          source: connection.source as string,
          sourceHandle: connection.sourceHandle,
          target: connection.target as string,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#94a3b8",
          },
          label: sourceOption.text || "Opcion",
          labelStyle: {
            fill: "#cbd5e1",
            fontSize: 10,
          },
          style: {
            stroke: "#64748b",
            strokeWidth: 1.6,
          },
        },
        filtered
      )
    })

    try {
      await updateOption(optionId, {
        text: sourceOption.text,
        order: sourceOption.order,
        nextCardId: connection.target,
      })
    } catch (error) {
      console.error("Error linking option in flow:", error)
    }
  }

  return (
    <div className="h-[72vh] rounded-lg border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2 text-xs text-slate-400">
        <span>Vista de secuencias tipo workflow (mover y conectar)</span>
        <Link href={`/editor/${gameId}/decks/${deckId}`} className="text-slate-300 hover:text-white">
          Volver a lista
        </Link>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection) => void handleConnect(connection)}
        fitView
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={18} size={1} color="#334155" />
      </ReactFlow>
    </div>
  )
}
