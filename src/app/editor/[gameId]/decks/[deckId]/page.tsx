"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  createCard,
  createOption,
  deleteCard,
  fetchCardsByDeckId,
  fetchDeckById,
  updateDeck,
} from "@/app/actions"
import { CardWithRelations } from "@/lib/services/prisma/cards"

type DeckModel = {
  id: string
  gameId: string
  name: string
  type: string
  weight: number
  description: string
}

type CardType = "decision" | "narrative" | "interactive"

export default function DeckPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const deckId = params.deckId as string

  const [deck, setDeck] = useState<DeckModel | null>(null)
  const [deckForm, setDeckForm] = useState({ name: "", type: "", weight: 1, description: "" })
  const [isEditingDeck, setIsEditingDeck] = useState(false)
  const [isSavingDeck, setIsSavingDeck] = useState(false)

  const [cards, setCards] = useState<CardWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "narrative" as CardType,
    priority: 0,
    tags: "",
    decisionOptionA: "",
    decisionOptionB: "",
  })

  useEffect(() => {
    loadDeckPage()
  }, [deckId])

  async function loadDeckPage() {
    try {
      setIsLoading(true)
      const [deckData, cardsData] = await Promise.all([fetchDeckById(deckId), fetchCardsByDeckId(deckId)])

      if (deckData) {
        const normalizedDeck: DeckModel = {
          id: deckData.id,
          gameId: deckData.gameId,
          name: deckData.name,
          type: deckData.type,
          weight: deckData.weight,
          description: deckData.description || "",
        }
        setDeck(normalizedDeck)
        setDeckForm({
          name: normalizedDeck.name,
          type: normalizedDeck.type,
          weight: normalizedDeck.weight,
          description: normalizedDeck.description,
        })
      } else {
        setDeck(null)
      }

      setCards(cardsData as CardWithRelations[])
    } catch (error) {
      console.error("Error loading deck page:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function loadCards() {
    try {
      const data = await fetchCardsByDeckId(deckId)
      setCards(data as CardWithRelations[])
    } catch (error) {
      console.error("Error loading cards:", error)
    }
  }

  function handleToggleEditDeck() {
    if (isEditingDeck && deck) {
      setDeckForm({
        name: deck.name,
        type: deck.type,
        weight: deck.weight,
        description: deck.description || "",
      })
    }
    setIsEditingDeck((prev) => !prev)
  }

  const isDeckDirty = useMemo(() => {
    if (!deck) return false

    return (
      deckForm.name.trim() !== deck.name ||
      deckForm.type.trim() !== deck.type ||
      deckForm.weight !== deck.weight ||
      deckForm.description.trim() !== (deck.description || "")
    )
  }, [deck, deckForm])

  async function handleSaveDeck(e: React.FormEvent) {
    e.preventDefault()
    if (!deck || !isDeckDirty) return

    const name = deckForm.name.trim()
    const type = deckForm.type.trim()
    const description = deckForm.description.trim()

    if (!name || !type || !Number.isInteger(deckForm.weight) || deckForm.weight < 1) {
      return
    }

    try {
      setIsSavingDeck(true)
      const updates = {
        name,
        type,
        weight: deckForm.weight,
        description,
      }

      await updateDeck(deck.id, gameId, updates)
      setDeck({ ...deck, ...updates })
      setIsEditingDeck(false)
    } catch (error) {
      console.error("Error saving deck:", error)
    } finally {
      setIsSavingDeck(false)
    }
  }

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault()

    const title = formData.title.trim()
    if (!title) return

    if (!Number.isInteger(formData.priority)) return

    if (formData.type === "interactive") {
      return
    }

    const optionA = formData.decisionOptionA.trim()
    const optionB = formData.decisionOptionB.trim()

    if (formData.type === "decision" && (!optionA || !optionB)) {
      return
    }

    try {
      const card = await createCard({
        deckId,
        title,
        type: formData.type,
        description: formData.description.trim(),
        priority: formData.priority,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })

      if (formData.type === "decision") {
        await createOption({ cardId: card.id, text: optionA, order: 1 })
        await createOption({ cardId: card.id, text: optionB, order: 2 })
      }

      await loadCards()
      setFormData({
        title: "",
        description: "",
        type: "narrative",
        priority: 0,
        tags: "",
        decisionOptionA: "",
        decisionOptionB: "",
      })
      setShowForm(false)
    } catch (error) {
      console.error("Error creating card:", error)
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm("¿Eliminar esta carta?")) return
    try {
      await deleteCard(cardId)
      await loadCards()
    } catch (error) {
      console.error("Error deleting card:", error)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>
  if (!deck) return <div className="p-8">Deck no encontrado</div>

  return (
    <div className="space-y-8 p-8">
      <section className="rounded border border-slate-700 bg-slate-800 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Configuracion del Deck</h1>
          <button
            type="button"
            onClick={handleToggleEditDeck}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {isEditingDeck ? "Cancelar edicion" : "Editar"}
          </button>
        </div>

        <form onSubmit={handleSaveDeck} className="space-y-4">
          <div>
            <label htmlFor="deck-config-name" className="mb-2 block text-sm font-semibold text-slate-200">
              Nombre
            </label>
            <input
              id="deck-config-name"
              type="text"
              value={deckForm.name}
              onChange={(e) => setDeckForm({ ...deckForm, name: e.target.value })}
              disabled={!isEditingDeck}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              required
            />
          </div>

          <div>
            <label htmlFor="deck-config-type" className="mb-2 block text-sm font-semibold text-slate-200">
              Tipo
            </label>
            <input
              id="deck-config-type"
              type="text"
              value={deckForm.type}
              onChange={(e) => setDeckForm({ ...deckForm, type: e.target.value })}
              disabled={!isEditingDeck}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              required
            />
          </div>

          <div>
            <label htmlFor="deck-config-weight" className="mb-2 block text-sm font-semibold text-slate-200">
              Peso del deck
            </label>
            <input
              id="deck-config-weight"
              type="number"
              min={1}
              step={1}
              value={deckForm.weight}
              onChange={(e) => setDeckForm({ ...deckForm, weight: Number(e.target.value) })}
              disabled={!isEditingDeck}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              required
            />
          </div>

          <div>
            <label htmlFor="deck-config-description" className="mb-2 block text-sm font-semibold text-slate-200">
              Descripcion
            </label>
            <textarea
              id="deck-config-description"
              value={deckForm.description}
              onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })}
              disabled={!isEditingDeck}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={!isEditingDeck || !isDeckDirty || isSavingDeck}
            className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingDeck ? "Guardando..." : "Guardar deck"}
          </button>
        </form>
      </section>

      <section className="rounded border border-slate-700 bg-slate-800 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold">Cartas</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nueva Carta"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreateCard} className="mb-6 rounded bg-slate-900/60 p-6">
            <div className="mb-4">
              <label htmlFor="card-title" className="mb-2 block text-sm font-semibold text-slate-200">
                Titulo
              </label>
              <input
                id="card-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="card-type" className="mb-2 block text-sm font-semibold text-slate-200">
                Tipo de carta
              </label>
              <select
                id="card-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as CardType })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              >
                <option value="narrative">Narrativo</option>
                <option value="decision">Decision</option>
                <option value="interactive" disabled>
                  Interactivo (no habilitado)
                </option>
              </select>
            </div>

            {formData.type === "decision" && (
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="decision-option-a" className="mb-2 block text-sm font-semibold text-slate-200">
                    Opcion A
                  </label>
                  <input
                    id="decision-option-a"
                    type="text"
                    value={formData.decisionOptionA}
                    onChange={(e) => setFormData({ ...formData, decisionOptionA: e.target.value })}
                    className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="decision-option-b" className="mb-2 block text-sm font-semibold text-slate-200">
                    Opcion B
                  </label>
                  <input
                    id="decision-option-b"
                    type="text"
                    value={formData.decisionOptionB}
                    onChange={(e) => setFormData({ ...formData, decisionOptionB: e.target.value })}
                    className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                    required
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="card-description" className="mb-2 block text-sm font-semibold text-slate-200">
                Descripcion
              </label>
              <textarea
                id="card-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="card-priority" className="mb-2 block text-sm font-semibold text-slate-200">
                Prioridad
              </label>
              <input
                id="card-priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="card-tags" className="mb-2 block text-sm font-semibold text-slate-200">
                Tags
              </label>
              <input
                id="card-tags"
                type="text"
                placeholder="separadas por coma"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              />
            </div>

            <button
              type="submit"
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              Crear
            </button>
          </form>
        )}

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
          {cards.map((card) => (
            <div key={card.id} className="rounded border border-slate-700 bg-slate-800 p-6 hover:border-slate-600">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Link href={`/editor/${gameId}/cards/${card.id}`}>
                    <h2 className="cursor-pointer text-xl font-bold text-blue-400 hover:text-blue-300">
                      {card.title}
                    </h2>
                  </Link>
                  <p className="mt-1 text-sm text-slate-400">Tipo: {card.type}</p>
                  <p className="mt-2 text-slate-400">{card.description}</p>
                  <div className="mt-2 flex gap-4 text-xs text-slate-500">
                    <span>Priority: {card.priority}</span>
                  </div>
                  {card.tags && card.tags.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {card.tags.map((tag) => (
                        <span key={tag} className="rounded bg-slate-700 px-2 py-1 text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        {cards.length === 0 && (
          <p className="py-12 text-center text-slate-400">No hay cartas. Crea una para comenzar.</p>
        )}
      </section>
    </div>
  )
}
