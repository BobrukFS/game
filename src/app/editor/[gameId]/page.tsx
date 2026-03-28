"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { fetchDecksByGameId, createDeck } from "@/app/actions"
import PathTrail from "@/components/editor/PathTrail"

type DeckListItem = {
  id: string
  gameId: string
  name: string
  type: string
  weight: number
  description: string
  repeatable?: boolean
  _count?: {
    cards: number
  }
}

type SortMode = "name-asc" | "name-desc" | "weight-desc" | "weight-asc" | "cards-desc"
type RepeatableFilter = "all" | "repeatable" | "non-repeatable"

export default function GamePage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [decks, setDecks] = useState<DeckListItem[]>([])
  const [deckTypes, setDeckTypes] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedRepeatableFilter, setSelectedRepeatableFilter] = useState<RepeatableFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("name-asc")
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: "", type: "", weight: 1, description: "" })

  useEffect(() => {
    loadDecks()
  }, [gameId])

  async function loadDecks() {
    try {
      setIsLoading(true)
      const data = (await fetchDecksByGameId(gameId)) as DeckListItem[]
      setDecks(data)
      const uniqueTypes = Array.from(
        new Set(
          data
            .map((deck: DeckListItem) => deck.type?.trim())
            .filter((type: string | undefined): type is string => Boolean(type))
        )
      )
      setDeckTypes(uniqueTypes)
    } catch (error) {
      console.error("Error loading decks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAndSortedDecks = useMemo(() => {
    let filtered =
      selectedType === "all"
        ? decks
        : decks.filter((deck) => deck.type.trim().toLowerCase() === selectedType.trim().toLowerCase())

    // Apply repeatable filter
    if (selectedRepeatableFilter === "repeatable") {
      filtered = filtered.filter((deck) => deck.repeatable !== false)
    } else if (selectedRepeatableFilter === "non-repeatable") {
      filtered = filtered.filter((deck) => deck.repeatable === false)
    }

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sortMode === "name-asc") return a.name.localeCompare(b.name)
      if (sortMode === "name-desc") return b.name.localeCompare(a.name)
      if (sortMode === "weight-desc") return b.weight - a.weight
      if (sortMode === "weight-asc") return a.weight - b.weight
      return (b._count?.cards || 0) - (a._count?.cards || 0)
    })

    return sorted
  }, [decks, selectedType, selectedRepeatableFilter, sortMode])

  async function handleCreateDeck(e: React.FormEvent) {
    e.preventDefault()

    const name = formData.name.trim()
    const type = formData.type.trim()

    if (!name || !type || !Number.isInteger(formData.weight) || formData.weight < 1) {
      return
    }

    try {
      await createDeck({
        gameId,
        name,
        type,
        weight: formData.weight,
        description: formData.description.trim(),
      })
      await loadDecks()
      setFormData({ name: "", type: "", weight: 1, description: "" })
      setShowForm(false)
    } catch (error) {
      console.error("Error creating deck:", error)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-8">
      <PathTrail
        items={[
          { label: "Editor", href: "/editor" },
          { label: "Decks" },
        ]}
      />
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Decks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
        >
          {showForm ? "Cancelar" : "+ Nuevo Deck"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">Nuevo deck</h2>
                <p className="text-sm text-slate-400">Completa los datos para crear el deck</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateDeck}>
              <div className="mb-4">
                <label htmlFor="deck-name" className="mb-2 block text-sm font-semibold text-slate-200">
                  Nombre
                </label>
                <input
                  id="deck-name"
                  type="text"
                  placeholder="Nombre"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 rounded text-white placeholder-slate-500"
                  required
                />
              </div>
              {deckTypes.length === 0 ? (
                <div className="mb-4">
                  <label htmlFor="deck-type" className="mb-2 block text-sm font-semibold text-slate-200">
                    Tipo
                  </label>
                  <input
                    id="deck-type"
                    type="text"
                    placeholder="Tipo (ej: story, shop, global)"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 rounded text-white placeholder-slate-500"
                    required
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <label htmlFor="deck-type" className="mb-2 block text-sm font-semibold text-slate-200">
                    Tipo
                  </label>
                  <input
                    id="deck-type"
                    type="text"
                    list="deck-type-options"
                    placeholder="Tipo"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 rounded text-white placeholder-slate-500"
                    required
                  />
                  <datalist id="deck-type-options">
                    {deckTypes.map((type) => (
                      <option key={type} value={type} />
                    ))}
                  </datalist>
                </div>
              )}
              <div className="mb-4">
                <label htmlFor="deck-weight" className="mb-2 block text-sm font-semibold text-slate-200">
                  Peso del deck
                </label>
                <input
                  id="deck-weight"
                  type="number"
                  min={1}
                  step={1}
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-700 rounded text-white placeholder-slate-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="deck-description" className="mb-2 block text-sm font-semibold text-slate-200">
                  Descripcion
                </label>
                <textarea
                  id="deck-description"
                  placeholder="Descripcion"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 rounded text-white placeholder-slate-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-6 rounded border border-slate-700 bg-slate-800/60 p-4">
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tipo</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedType("all")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                selectedType === "all"
                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                  : "border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Todos
            </button>
            {deckTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  selectedType === type
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Repetibilidad</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedRepeatableFilter("all")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                selectedRepeatableFilter === "all"
                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                  : "border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedRepeatableFilter("repeatable")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                selectedRepeatableFilter === "repeatable"
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Repetibles
            </button>
            <button
              type="button"
              onClick={() => setSelectedRepeatableFilter("non-repeatable")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                selectedRepeatableFilter === "non-repeatable"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-slate-600 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Una sola vez
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="deck-sort" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ordenar por
          </label>
          <select
            id="deck-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="name-asc">Nombre (A-Z)</option>
            <option value="name-desc">Nombre (Z-A)</option>
            <option value="weight-desc">Peso (alto a bajo)</option>
            <option value="weight-asc">Peso (bajo a alto)</option>
            <option value="cards-desc">Cantidad de cartas</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredAndSortedDecks.map((deck) => (
          <Link
            key={deck.id}
            href={`/editor/${gameId}/decks/${deck.id}`}
            className="group rounded-lg border border-slate-700 bg-slate-800 p-5 transition-colors hover:border-slate-500"
          >
            <h2 className="text-xl font-bold text-blue-300 group-hover:text-blue-200">{deck.name}</h2>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/50 bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                {deck.type}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M6 7h12l-1 10H7L6 7Z" />
                  <path d="M12 7V4" />
                  <path d="M9 4h6" />
                </svg>
                {deck.weight}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="3" y="5" width="14" height="14" rx="2" />
                  <path d="M7 9h10" />
                  <path d="M7 13h8" />
                </svg>
                {deck._count?.cards || 0} cartas
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                deck.repeatable !== false
                  ? "border border-cyan-400/50 bg-cyan-600/10 text-cyan-200"
                  : "border border-amber-400/50 bg-amber-600/10 text-amber-200"
              }`}>
                {deck.repeatable !== false ? (
                  <>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12a8 8 0 0 1 15.5-1m0 0H19m0 0v3m-18 1A8 8 0 0 0 19.5 5m0 0H5m0 0V2" />
                    </svg>
                    Repetible
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    Una sola vez
                  </>
                )}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-400">{deck.description || "Sin descripcion"}</p>
          </Link>
        ))}
      </div>

      {filteredAndSortedDecks.length === 0 && (
        <p className="text-slate-400 text-center py-12">No hay decks. Crea uno para comenzar.</p>
      )}
    </div>
  )
}
