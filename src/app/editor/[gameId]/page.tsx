"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { fetchDecksByGameId, createDeck, deleteDeck } from "@/app/actions"
type DeckListItem = {
  id: string
  gameId: string
  name: string
  type: string
  weight: number
  description: string
}

export default function GamePage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [decks, setDecks] = useState<DeckListItem[]>([])
  const [deckTypes, setDeckTypes] = useState<string[]>([])
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

  async function handleDeleteDeck(deckId: string) {
    if (!confirm("¿Eliminar este deck?")) return
    try {
      await deleteDeck(deckId, gameId)
      await loadDecks()
    } catch (error) {
      console.error("Error deleting deck:", error)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-8">
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
        <form onSubmit={handleCreateDeck} className="mb-8 bg-slate-800 p-6 rounded">
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
          <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white">
            Crear
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {decks.map((deck) => (
          <div key={deck.id} className="bg-slate-800 p-6 rounded border border-slate-700 hover:border-slate-600">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Link href={`/editor/${gameId}/decks/${deck.id}`}>
                  <h2 className="text-xl font-bold text-blue-400 hover:text-blue-300 cursor-pointer">
                    {deck.name}
                  </h2>
                </Link>
                <p className="text-slate-400 text-sm mt-1">Tipo: {deck.type}</p>
                <p className="text-slate-400 text-sm mt-1">Peso: {deck.weight}</p>
                <p className="text-slate-400 mt-2">{deck.description}</p>
              </div>
              <button
                onClick={() => handleDeleteDeck(deck.id)}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {decks.length === 0 && (
        <p className="text-slate-400 text-center py-12">No hay decks. Crea uno para comenzar.</p>
      )}
    </div>
  )
}
