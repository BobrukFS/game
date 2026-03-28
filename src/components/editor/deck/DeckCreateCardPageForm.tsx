"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { createCard } from "@/app/actions"
import type { DeckCardType } from "@/components/editor/deck/types"

export default function DeckCreateCardPageForm({
  gameId,
  deckId,
}: {
  gameId: string
  deckId: string
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [cardData, setCardData] = useState({
    title: "",
    type: "narrative" as DeckCardType,
    description: "",
    tags: "",
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const title = cardData.title.trim()
    if (!title || cardData.type === "interactive") return

    try {
      setIsSaving(true)

      const createdCard = await createCard({
        deckId,
        title,
        type: cardData.type,
        description: cardData.description.trim(),
        tags: cardData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      router.push(`/editor/${gameId}/cards/${createdCard.id}`)
    } catch (error) {
      console.error("Error creating card:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8 text-slate-100">
      <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Editor / Decks / Cartas / Nueva carta</p>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nueva carta</h1>
          <p className="mt-1 text-sm text-slate-400">
            Este paso crea la base. Luego editas condiciones, opciones, efectos y siguiente carta en la misma vista de edicion.
          </p>
        </div>
        <Link
          href={`/editor/${gameId}/decks/${deckId}`}
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Volver a cartas
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded bg-slate-800 p-6">
        <div>
          <label htmlFor="create-card-title" className="mb-2 block text-sm font-semibold text-slate-200">
            Titulo
          </label>
          <input
            id="create-card-title"
            type="text"
            value={cardData.title}
            onChange={(e) => setCardData((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            required
          />
        </div>

        <div>
          <label htmlFor="create-card-type" className="mb-2 block text-sm font-semibold text-slate-200">
            Tipo de carta
          </label>
          <select
            id="create-card-type"
            value={cardData.type}
            onChange={(e) => setCardData((prev) => ({ ...prev, type: e.target.value as DeckCardType }))}
            className="w-full rounded bg-slate-700 px-4 py-2 text-white"
          >
            <option value="narrative">Narrativo</option>
            <option value="decision">Decision</option>
            <option value="interactive" disabled>
              Interactivo (no habilitado)
            </option>
          </select>
        </div>

        <div>
          <label htmlFor="create-card-description" className="mb-2 block text-sm font-semibold text-slate-200">
            Descripcion
          </label>
          <textarea
            id="create-card-description"
            value={cardData.description}
            onChange={(e) => setCardData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="create-card-tags" className="mb-2 block text-sm font-semibold text-slate-200">
            Tags
          </label>
          <input
            id="create-card-tags"
            type="text"
            value={cardData.tags}
            onChange={(e) => setCardData((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="Tags separadas por coma"
            className="w-full rounded bg-slate-700 px-4 py-2 text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={`/editor/${gameId}/decks/${deckId}`}
            className="rounded border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 font-semibold text-emerald-200 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Creando..." : "Crear y editar"}
          </button>
        </div>
      </form>
    </div>
  )
}
