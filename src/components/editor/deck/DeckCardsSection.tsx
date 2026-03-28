"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import DeckCardSequenceGrid from "./DeckCardSequenceGrid"
import { DeckCard } from "@/components/editor/deck/types"
import { deleteCard } from "@/app/actions"
import ConfirmModal from "@/components/editor/ConfirmModal"
import PathTrail from "@/components/editor/PathTrail"

type CardsViewMode = "list" | "grid"

function reorderByDrag<T>(items: T[], startIndex: number, endIndex: number) {
  const result = [...items]
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}

export default function DeckCardsSection({
  deckId,
  gameId,
  initialCards,
}: {
  deckId: string
  gameId: string
  initialCards: DeckCard[]
}) {
  const router = useRouter()
  const [cards, setCards] = useState<DeckCard[]>(initialCards)
  const [viewMode, setViewMode] = useState<CardsViewMode>("list")
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<DeckCard | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const draggedHasMovedRef = useRef(false)

  useEffect(() => {
    setCards(initialCards)
  }, [initialCards])

  const levelByCardId = useMemo(() => {
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
    const level = new Map<string, number>()

    cards.forEach((card) => {
      if ((incomingCount.get(card.id) || 0) === 0) {
        queue.push(card.id)
        level.set(card.id, 1)
      }
    })

    while (queue.length > 0) {
      const current = queue.shift() as string
      const currentLevel = level.get(current) || 1
      const nextCards = adjacency.get(current) || []

      nextCards.forEach((nextId) => {
        const prev = level.get(nextId) || 1
        if (currentLevel + 1 > prev) {
          level.set(nextId, currentLevel + 1)
        }
        const remaining = (incomingCount.get(nextId) || 1) - 1
        incomingCount.set(nextId, remaining)
        if (remaining <= 0) {
          queue.push(nextId)
        }
      })
    }

    cards.forEach((card) => {
      if (!level.has(card.id)) {
        level.set(card.id, 1)
      }
    })

    return level
  }, [cards])

  const rootLevelCards = useMemo(() => {
    return cards.filter((card) => (levelByCardId.get(card.id) || 1) === 1)
  }, [cards, levelByCardId])

  const availableTags = useMemo(() => {
    return Array.from(new Set(cards.flatMap((card) => card.tags || []).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [cards])

  const visibleCards = useMemo(() => {
    if (selectedTag === "all") return cards
    return cards.filter((card) => (card.tags || []).includes(selectedTag))
  }, [cards, selectedTag])

  async function confirmDeleteCard() {
    if (!deleteTarget) return

    try {
      setIsDeleting(true)
      await deleteCard(deleteTarget.id)
      setCards((prev) => prev.filter((card) => card.id !== deleteTarget.id))
      setDeleteTarget(null)
      router.refresh()
    } catch (error) {
      console.error("Error deleting card from deck list:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  function handleDragOverCard(targetCardId: string) {
    if (!draggingCardId || draggingCardId === targetCardId) {
      return
    }

    setCards((prev) => {
      const fromIndex = prev.findIndex((card) => card.id === draggingCardId)
      const toIndex = prev.findIndex((card) => card.id === targetCardId)

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return prev
      }

      draggedHasMovedRef.current = true
      return reorderByDrag(prev, fromIndex, toIndex)
    })
  }

  function handleDropCard() {
    if (!draggingCardId) {
      setDraggingCardId(null)
      return
    }
    // Local reorder only: no persistence needed when sequence graph is unchanged.
    setDraggingCardId(null)
  }

  return (
    <section className="rounded border border-slate-700 bg-slate-800 p-6">
      <PathTrail
        items={[
          { label: "Editor", href: "/editor" },
          { label: "Decks", href: `/editor/${gameId}` },
          { label: "Cartas" },
        ]}
      />
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Cartas</h2>
        <Link
          href={`/editor/${gameId}/decks/${deckId}/cards/new`}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + Nueva Carta
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
        <p className="text-sm text-slate-400">
          Drag and drop para acomodar visualmente la lista. El flujo real lo define las conexiones.
        </p>
        <div className="inline-flex rounded-md border border-slate-600 bg-slate-900 p-1 text-sm">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded px-3 py-1.5 transition-colors ${
              viewMode === "list"
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-700/70"
            }`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded px-3 py-1.5 transition-colors ${
              viewMode === "grid"
                ? "bg-slate-700 text-white"
                : "text-slate-300 hover:bg-slate-700/70"
            }`}
          >
            Cuadrilla de secuencias
          </button>
        </div>
      </div>

      {availableTags.length > 0 && (
        <div className="mb-4 rounded-md border border-slate-700 bg-slate-900/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Filtrar por tag</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTag("all")}
              className={`rounded-full border px-3 py-1 text-xs ${
                selectedTag === "all"
                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                  : "border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Todos
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selectedTag === tag
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode === "list" && (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
          {rootLevelCards.length > 1 && (
            <div className="rounded-md border border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              Aviso: hay multiples cartas en nivel 1 ({rootLevelCards.length}). Revisa ramas iniciales duplicadas.
            </div>
          )}

          {visibleCards.map((card) => {
            const isDragging = card.id === draggingCardId
            const isRootConflict = rootLevelCards.length > 1 && (levelByCardId.get(card.id) || 1) === 1
            return (
              <div
                key={card.id}
                draggable
                role="button"
                tabIndex={0}
                onDragStart={() => {
                  draggedHasMovedRef.current = false
                  setDraggingCardId(card.id)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  handleDragOverCard(card.id)
                }}
                onDrop={() => handleDropCard()}
                onDragEnd={() => setDraggingCardId(null)}
                onClick={() => {
                  if (draggedHasMovedRef.current) {
                    draggedHasMovedRef.current = false
                    return
                  }
                  router.push(`/editor/${gameId}/cards/${card.id}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`/editor/${gameId}/cards/${card.id}`)
                  }
                }}
                className={`rounded border bg-slate-800 p-6 transition-colors ${
                  isDragging
                    ? "border-blue-500/70 opacity-70"
                    : isRootConflict
                      ? "border-red-500/60 bg-red-950/20 hover:border-red-400"
                      : "border-slate-700 hover:border-slate-500"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-blue-400 hover:text-blue-300">{card.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">Tipo: {card.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDeleteTarget(card)
                    }}
                    title="Eliminar carta"
                    className="rounded-md border border-red-400/50 p-1.5 text-red-300 transition-colors hover:bg-red-600/20"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1">
                  <p className="mt-1 text-sm text-slate-400">Tipo: {card.type}</p>
                  <p className="mt-2 text-slate-400">{card.description}</p>
                  <div className="mt-2 flex gap-4 text-xs text-slate-500">
                    <span>Nivel: {levelByCardId.get(card.id) || 1}</span>
                    <span>Conexiones: {card.options.length}</span>
                  </div>
                  {card.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card.tags.map((tag) => (
                        <span key={`${card.id}-${tag}`} className="rounded bg-slate-700 px-2 py-1 text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewMode === "grid" && <DeckCardSequenceGrid cards={cards} gameId={gameId} deckId={deckId} />}

      {visibleCards.length === 0 && (
        <p className="py-12 text-center text-slate-400">No hay cartas. Crea una para comenzar.</p>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar carta"
        message={`Se eliminara la carta ${deleteTarget?.title || ""} y sus opciones/efectos asociados. Esta accion no se puede deshacer.`}
        confirmLabel={isDeleting ? "Eliminando..." : "Si, eliminar carta"}
        onConfirm={confirmDeleteCard}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}
