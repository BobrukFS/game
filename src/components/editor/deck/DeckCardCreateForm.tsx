"use client"

import { FormEvent, useState } from "react"
import { createCard, createOption } from "@/app/actions"
import { DeckCardType } from "@/components/editor/deck/types"

type CreateCardFormState = {
  title: string
  description: string
  type: DeckCardType
  priority: string
  tags: string
  decisionOptionA: string
  decisionOptionB: string
}

const INITIAL_FORM: CreateCardFormState = {
  title: "",
  description: "",
  type: "narrative",
  priority: "",
  tags: "",
  decisionOptionA: "",
  decisionOptionB: "",
}

export default function DeckCardCreateForm({
  deckId,
  onCreated,
}: {
  deckId: string
  onCreated: () => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CreateCardFormState>(INITIAL_FORM)

  async function handleCreateCard(e: FormEvent) {
    e.preventDefault()

    const title = formData.title.trim()
    if (!title) return
    if (formData.type === "interactive") return

    const normalizedPriority = formData.priority.trim()
    if (normalizedPriority !== "" && !Number.isInteger(Number(normalizedPriority))) {
      return
    }

    const optionA = formData.decisionOptionA.trim()
    const optionB = formData.decisionOptionB.trim()
    if (formData.type === "decision" && (!optionA || !optionB)) {
      return
    }

    try {
      setIsSubmitting(true)
      const card = await createCard({
        deckId,
        title,
        type: formData.type,
        description: formData.description.trim(),
        priority: normalizedPriority === "" ? undefined : Number(normalizedPriority),
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      if (formData.type === "decision") {
        await createOption({ cardId: card.id, text: optionA, order: 1 })
        await createOption({ cardId: card.id, text: optionB, order: 2 })
      }

      await onCreated()
      setFormData(INITIAL_FORM)
      setShowForm(false)
    } catch (error) {
      console.error("Error creating deck card:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Cartas</h2>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "+ Nueva Carta"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateCard} className="rounded border border-slate-700 bg-slate-900/60 p-6">
          <div className="mb-4">
            <label htmlFor="card-title" className="mb-2 block text-sm font-semibold text-slate-200">
              Titulo
            </label>
            <input
              id="card-title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as DeckCardType }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, decisionOptionA: e.target.value }))}
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, decisionOptionB: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              placeholder="Sin prioridad"
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
              onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creando..." : "Crear"}
          </button>
        </form>
      )}
    </div>
  )
}
