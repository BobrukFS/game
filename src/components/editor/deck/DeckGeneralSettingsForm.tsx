"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  createDeckCondition,
  deleteDeckCondition,
  fetchDeckConditionsByDeckId,
  fetchFlagKeysByGameId,
  updateDeck,
} from "@/app/actions"
import { DeckModel } from "@/components/editor/deck/types"

type DeckCondition = {
  id: string
  deckId: string
  dataType: string
  operator: "equal" | "not_equal"
  key: string
  logicOperator: "AND" | "OR"
  order: number
}

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
    repeatable: deck.repeatable ?? true,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deckConditions, setDeckConditions] = useState<DeckCondition[]>([])
  const [flagKeys, setFlagKeys] = useState<string[]>([])
  const [newDeckCondition, setNewDeckCondition] = useState({
    operator: "equal" as "equal" | "not_equal",
    key: "",
    logicOperator: "AND" as "AND" | "OR",
  })

  const isDirty = useMemo(() => {
    return (
      formData.name.trim() !== deck.name ||
      formData.type.trim() !== deck.type ||
      formData.weight !== deck.weight ||
      formData.description.trim() !== (deck.description || "") ||
      formData.repeatable !== (deck.repeatable ?? true)
    )
  }, [deck.description, deck.name, deck.type, deck.weight, deck.repeatable, formData])

  useEffect(() => {
    void loadDeckConditions()
  }, [deck.id, deck.gameId])

  async function loadDeckConditions() {
    try {
      const [conditions, flags] = await Promise.all([
        fetchDeckConditionsByDeckId(deck.id),
        fetchFlagKeysByGameId(deck.gameId),
      ])

      setDeckConditions(conditions as DeckCondition[])
      setFlagKeys(flags as string[])
    } catch (error) {
      console.error("Error loading deck conditions:", error)
    }
  }

  function toggleEdit() {
    if (isEditing) {
      setFormData({
        name: deck.name,
        type: deck.type,
        weight: deck.weight,
        description: deck.description || "",
        repeatable: deck.repeatable ?? true,
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
        repeatable: formData.repeatable,
      })
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving deck general settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddDeckCondition(e: FormEvent) {
    e.preventDefault()
    if (!isEditing) return

    const key = newDeckCondition.key.trim()
    if (!key) return

    try {
      await createDeckCondition(deck.id, {
        dataType: "flag",
        operator: newDeckCondition.operator,
        key,
        logicOperator: deckConditions.length > 0 ? newDeckCondition.logicOperator : "AND",
        order: deckConditions.length + 1,
      })

      setNewDeckCondition({ operator: "equal", key: "", logicOperator: "AND" })
      await loadDeckConditions()
    } catch (error) {
      console.error("Error adding deck condition:", error)
    }
  }

  async function handleDeleteDeckCondition(id: string) {
    if (!isEditing) return
    try {
      await deleteDeckCondition(id, deck.id)
      await loadDeckConditions()
    } catch (error) {
      console.error("Error deleting deck condition:", error)
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

        <div className="flex items-center gap-3">
          <input
            id="deck-settings-repeatable"
            type="checkbox"
            checked={formData.repeatable}
            disabled={!isEditing}
            onChange={(e) => setFormData((prev) => ({ ...prev, repeatable: e.target.checked }))}
            className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900 text-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <label htmlFor="deck-settings-repeatable" className="text-sm text-slate-200 cursor-pointer">
            Este deck puede repetirse despues de completarse
          </label>
        </div>

        <button
          type="submit"
          disabled={!isEditing || !isDirty || isSaving}
          className="rounded-md border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </button>

        <div className="mt-6 border-t border-slate-700 pt-4">
          <h3 className="mb-2 text-sm font-semibold">Condiciones del deck (solo flags)</h3>
          <p className="mb-3 text-xs text-slate-400">
            Si no se cumplen, ninguna carta de este deck podrá salir.
          </p>

          <form onSubmit={handleAddDeckCondition} className="mb-3 grid gap-2 md:grid-cols-4">
            <select
              value={newDeckCondition.key}
              onChange={(e) => setNewDeckCondition((prev) => ({ ...prev, key: e.target.value }))}
              disabled={!isEditing}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-70"
            >
              <option value="">Selecciona flag</option>
              {flagKeys.map((flagKey) => (
                <option key={flagKey} value={flagKey}>
                  {flagKey}
                </option>
              ))}
            </select>

            <select
              value={newDeckCondition.operator}
              onChange={(e) =>
                setNewDeckCondition((prev) => ({
                  ...prev,
                  operator: e.target.value as "equal" | "not_equal",
                }))
              }
              disabled={!isEditing || !newDeckCondition.key}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-70"
            >
              <option value="equal">Flag activo (equal)</option>
              <option value="not_equal">Flag inactivo (not_equal)</option>
            </select>

            <select
              value={newDeckCondition.logicOperator}
              onChange={(e) =>
                setNewDeckCondition((prev) => ({
                  ...prev,
                  logicOperator: e.target.value as "AND" | "OR",
                }))
              }
              disabled={!isEditing || deckConditions.length === 0}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-70"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>

            <button
              type="submit"
              disabled={!isEditing}
              className="rounded-md border border-blue-400/60 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-600/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Agregar condición
            </button>
          </form>

          <div className="space-y-2">
            {deckConditions.length === 0 ? (
              <p className="text-xs text-slate-400">Sin condiciones de deck.</p>
            ) : (
              deckConditions.map((condition, index) => (
                <div key={condition.id} className="rounded-md border border-slate-700 bg-slate-900/70 p-2 text-sm">
                  {index > 0 && (
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
                      {condition.logicOperator}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-200">
                      flag <strong>{condition.key}</strong> {condition.operator === "equal" ? "= true" : "= false"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDeckCondition(condition.id)}
                      disabled={!isEditing}
                      className="rounded border border-red-400/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </form>
    </section>
  )
}
