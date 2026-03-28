"use client"

import { FormEvent, useMemo, useState } from "react"
import { updateDeck } from "@/app/actions"
import { DeckModel } from "@/components/editor/deck/types"

export default function DeckGeneralSettingsForm({
  deck,
}: {
  deck: DeckModel
}) {
  const [formData, setFormData] = useState({
    name: deck.name,
    type: deck.type,
    weight: deck.weight,
    description: deck.description || "",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const isDirty = useMemo(() => {
    return (
      formData.name.trim() !== deck.name ||
      formData.type.trim() !== deck.type ||
      formData.weight !== deck.weight ||
      formData.description.trim() !== (deck.description || "")
    )
  }, [deck.description, deck.name, deck.type, deck.weight, formData])

  function toggleEdit() {
    if (isEditing) {
      setFormData({
        name: deck.name,
        type: deck.type,
        weight: deck.weight,
        description: deck.description || "",
      })
    }

    setIsEditing((prev) => !prev)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!isDirty) return

    const name = formData.name.trim()
    const type = formData.type.trim()
    const description = formData.description.trim()

    if (!name || !type || !Number.isInteger(formData.weight) || formData.weight < 1) {
      return
    }

    try {
      setIsSaving(true)
      await updateDeck(deck.id, deck.gameId, {
        name,
        type,
        weight: formData.weight,
        description,
      })
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving deck general settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/70">
      <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
        <h2 className="text-sm font-semibold">General</h2>
        <button
          type="button"
          onClick={toggleEdit}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          {isEditing ? "Cancelar" : "Editar"}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-4 px-5 py-5">
        <div>
          <label htmlFor="deck-settings-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Nombre
          </label>
          <input
            id="deck-settings-name"
            value={formData.name}
            disabled={!isEditing}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="deck-settings-type" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tipo
            </label>
            <input
              id="deck-settings-type"
              value={formData.type}
              disabled={!isEditing}
              onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div>
            <label htmlFor="deck-settings-weight" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Peso
            </label>
            <input
              id="deck-settings-weight"
              type="number"
              min={1}
              step={1}
              value={formData.weight}
              disabled={!isEditing}
              onChange={(e) => setFormData((prev) => ({ ...prev, weight: Number(e.target.value) }))}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>
        </div>

        <div>
          <label htmlFor="deck-settings-description" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Descripcion
          </label>
          <textarea
            id="deck-settings-description"
            value={formData.description}
            disabled={!isEditing}
            rows={4}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>

        <button
          type="submit"
          disabled={!isEditing || !isDirty || isSaving}
          className="rounded-md border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </section>
  )
}
