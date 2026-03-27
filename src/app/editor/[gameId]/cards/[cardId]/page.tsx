"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  createCondition,
  createEffect,
  createOption,
  deleteCondition,
  deleteEffect,
  deleteOption,
  fetchCardById,
  updateCard,
} from "@/app/actions"
import { Condition, ConditionType } from "@/lib/domain"
import { CardWithRelations } from "@/lib/services/prisma/cards"
import { OptionWithEffects } from "@/lib/services/prisma/options"

type CardType = "decision" | "narrative" | "interactive"

export default function CardPage() {
  const params = useParams()
  const cardId = params.cardId as string

  const [card, setCard] = useState<CardWithRelations | null>(null)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [options, setOptions] = useState<OptionWithEffects[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [editingCard, setEditingCard] = useState(false)
  const [cardForm, setCardForm] = useState({
    title: "",
    type: "narrative" as CardType,
    description: "",
    priority: 0,
    tags: "",
  })

  const [newCondition, setNewCondition] = useState<{ type: ConditionType | ""; key: string; value: string }>({
    type: "",
    key: "",
    value: "",
  })
  const [newOption, setNewOption] = useState({ text: "", nextCardId: "" })
  const [newEffect, setNewEffect] = useState<{ optionId: string; type: string; key: string; value: string } | null>(
    null
  )

  useEffect(() => {
    loadCard()
  }, [cardId])

  async function loadCard() {
    try {
      setIsLoading(true)
      const cardData = await fetchCardById(cardId)
      if (cardData) {
        setCard(cardData as CardWithRelations)
        setCardForm({
          title: cardData.title,
          type: cardData.type as CardType,
          description: cardData.description,
          priority: cardData.priority || 0,
          tags: cardData.tags.join(", "),
        })
        setConditions((cardData.conditions || []) as Condition[])
        setOptions((cardData.options || []) as OptionWithEffects[])
      }
    } catch (error) {
      console.error("Error loading card:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveCard() {
    const title = cardForm.title.trim()
    if (!title || !Number.isInteger(cardForm.priority)) {
      return
    }

    if (cardForm.type === "interactive") {
      return
    }

    if (card && cardForm.type === "narrative" && options.length > 0) {
      return
    }

    try {
      await updateCard(cardId, {
        title,
        type: cardForm.type,
        description: cardForm.description.trim(),
        priority: cardForm.priority,
        tags: cardForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      setEditingCard(false)
      await loadCard()
    } catch (error) {
      console.error("Error saving card:", error)
    }
  }

  async function handleAddCondition(e: React.FormEvent) {
    e.preventDefault()

    const type = newCondition.type.trim()
    const key = newCondition.key.trim()
    const value = newCondition.value.trim()

    if (!type || !key) {
      return
    }

    if ((type === "stat_min" || type === "stat_max") && !value) {
      return
    }

    try {
      await createCondition(cardId, {
        type,
        key,
        value: type === "flag" || type === "not_flag" ? undefined : value,
      })
      setNewCondition({ type: "", key: "", value: "" })
      await loadCard()
    } catch (error) {
      console.error("Error adding condition:", error)
    }
  }

  async function handleDeleteCondition(conditionId: string) {
    try {
      await deleteCondition(conditionId)
      await loadCard()
    } catch (error) {
      console.error("Error deleting condition:", error)
    }
  }

  async function handleAddOption(e: React.FormEvent) {
    e.preventDefault()

    if (cardForm.type !== "decision") {
      return
    }

    if (options.length >= 2) {
      return
    }

    const text = newOption.text.trim()
    if (!text) {
      return
    }

    try {
      await createOption({
        cardId,
        text,
        order: options.length + 1,
        nextCardId: newOption.nextCardId.trim() || undefined,
      })
      setNewOption({ text: "", nextCardId: "" })
      await loadCard()
    } catch (error) {
      console.error("Error adding option:", error)
    }
  }

  async function handleDeleteOption(optionId: string) {
    try {
      await deleteOption(optionId)
      await loadCard()
    } catch (error) {
      console.error("Error deleting option:", error)
    }
  }

  async function handleAddEffect(e: React.FormEvent, optionId: string) {
    e.preventDefault()
    if (!newEffect || newEffect.optionId !== optionId) return

    const type = newEffect.type.trim()
    const key = newEffect.key.trim()
    const value = newEffect.value.trim()

    if (!type || !key || !value) {
      return
    }

    try {
      await createEffect(optionId, { type, key, value })
      setNewEffect(null)
      await loadCard()
    } catch (error) {
      console.error("Error adding effect:", error)
    }
  }

  async function handleDeleteEffect(effectId: string) {
    try {
      await deleteEffect(effectId)
      await loadCard()
    } catch (error) {
      console.error("Error deleting effect:", error)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>
  if (!card) return <div className="p-8">Carta no encontrada</div>

  return (
    <div className="max-w-6xl p-8">
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-4xl font-bold">{card.title}</h1>
          <button
            onClick={() => setEditingCard(!editingCard)}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {editingCard ? "Cancelar" : "Editar Carta"}
          </button>
        </div>

        {editingCard ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveCard()
            }}
            className="space-y-4 rounded bg-slate-800 p-6"
          >
            <div>
              <label htmlFor="edit-card-title" className="mb-2 block text-sm font-semibold text-slate-200">
                Titulo
              </label>
              <input
                id="edit-card-title"
                type="text"
                value={cardForm.title}
                onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-card-type" className="mb-2 block text-sm font-semibold text-slate-200">
                Tipo de carta
              </label>
              <select
                id="edit-card-type"
                value={cardForm.type}
                onChange={(e) => setCardForm({ ...cardForm, type: e.target.value as CardType })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              >
                <option value="narrative">Narrativo</option>
                <option value="decision">Decision</option>
                <option value="interactive" disabled>
                  Interactivo (no habilitado)
                </option>
              </select>
              {cardForm.type === "narrative" && options.length > 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Para pasar a narrativo primero elimina las opciones existentes.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="edit-card-description" className="mb-2 block text-sm font-semibold text-slate-200">
                Descripcion
              </label>
              <textarea
                id="edit-card-description"
                value={cardForm.description}
                onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="edit-card-priority" className="mb-2 block text-sm font-semibold text-slate-200">
                Prioridad
              </label>
              <input
                id="edit-card-priority"
                type="number"
                value={cardForm.priority}
                onChange={(e) => setCardForm({ ...cardForm, priority: Number(e.target.value) })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="edit-card-tags" className="mb-2 block text-sm font-semibold text-slate-200">
                Tags
              </label>
              <input
                id="edit-card-tags"
                type="text"
                value={cardForm.tags}
                onChange={(e) => setCardForm({ ...cardForm, tags: e.target.value })}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                placeholder="Tags separadas por coma"
              />
            </div>

            <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
              Guardar
            </button>
          </form>
        ) : (
          <div className="rounded bg-slate-800 p-6">
            <p className="mb-2 text-slate-300">{card.description}</p>
            <div className="flex gap-4 text-sm text-slate-400">
              <span>Tipo: {card.type}</span>
              <span>Priority: {card.priority}</span>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-8">
        <section>
          <h2 className="mb-4 text-2xl font-bold">Condiciones</h2>

          <form onSubmit={handleAddCondition} className="mb-4 rounded bg-slate-800 p-4">
            <label htmlFor="new-condition-type" className="mb-1 block text-xs font-semibold text-slate-300">
              Tipo
            </label>
            <select
              id="new-condition-type"
              value={newCondition.type}
              onChange={(e) =>
                setNewCondition((prev) => ({
                  ...prev,
                  type: e.target.value as ConditionType | "",
                  value:
                    e.target.value === "flag" || e.target.value === "not_flag" ? "" : prev.value,
                }))
              }
              className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white"
              required
            >
              <option value="">Selecciona tipo</option>
              <option value="stat_min">Stat Min</option>
              <option value="stat_max">Stat Max</option>
              <option value="flag">Flag</option>
              <option value="not_flag">Not Flag</option>
              <option value="world_state">World State</option>
            </select>
            <label htmlFor="new-condition-key" className="mb-1 block text-xs font-semibold text-slate-300">
              Key
            </label>
            <input
              id="new-condition-key"
              type="text"
              placeholder="Key"
              value={newCondition.key}
              onChange={(e) => setNewCondition({ ...newCondition, key: e.target.value })}
              className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white placeholder-slate-500"
              required
            />
            {(newCondition.type === "stat_min" || newCondition.type === "stat_max" || newCondition.type === "world_state") && (
              <>
                <label htmlFor="new-condition-value" className="mb-1 block text-xs font-semibold text-slate-300">
                  {newCondition.type === "world_state" ? "Value" : "Value numerico"}
                </label>
                <input
                  id="new-condition-value"
                  type={newCondition.type === "world_state" ? "text" : "number"}
                  step={newCondition.type === "world_state" ? undefined : "any"}
                  placeholder="0"
                  value={newCondition.value}
                  onChange={(e) => setNewCondition({ ...newCondition, value: e.target.value })}
                  className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white placeholder-slate-500"
                  required
                />
              </>
            )}
            <button type="submit" className="w-full rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">
              Agregar
            </button>
          </form>

          <div className="space-y-2">
            {conditions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded bg-slate-800 p-3">
                <div className="text-sm">
                  <p className="font-semibold">{c.type}</p>
                  {c.type === "flag" || c.type === "not_flag" ? (
                    <p className="text-slate-400">{c.key}</p>
                  ) : (
                    <p className="text-slate-400">
                      {c.key}: {String(c.value)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteCondition(c.id!)}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">Opciones</h2>

          {card.type !== "decision" ? (
            <div className="rounded bg-slate-800 p-4 text-sm text-slate-300">
              Esta carta es {card.type}. Solo las cartas de tipo decision tienen opciones y efectos.
            </div>
          ) : (
            <>
              <form onSubmit={handleAddOption} className="mb-4 rounded bg-slate-800 p-4">
                <label htmlFor="new-option-text" className="mb-1 block text-xs font-semibold text-slate-300">
                  Texto de la opcion
                </label>
                <input
                  id="new-option-text"
                  type="text"
                  placeholder="Texto de la opcion"
                  value={newOption.text}
                  onChange={(e) => setNewOption({ ...newOption, text: e.target.value })}
                  className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white placeholder-slate-500"
                  required
                />
                <label htmlFor="new-option-next-card" className="mb-1 block text-xs font-semibold text-slate-300">
                  Next Card ID
                </label>
                <input
                  id="new-option-next-card"
                  type="text"
                  placeholder="opcional"
                  value={newOption.nextCardId}
                  onChange={(e) => setNewOption({ ...newOption, nextCardId: e.target.value })}
                  className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={options.length >= 2}
                  className="w-full rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {options.length >= 2 ? "Maximo 2 opciones" : "Agregar opcion"}
                </button>
              </form>

              <div className="space-y-4">
                {options.map((opt) => (
                  <div key={opt.id} className="rounded border border-slate-700 bg-slate-800 p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <p className="font-semibold">{opt.text}</p>
                      <button
                        onClick={() => handleDeleteOption(opt.id)}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      >
                        Eliminar
                      </button>
                    </div>

                    {opt.nextCardId && <p className="mb-3 text-xs text-slate-400">Next: {opt.nextCardId}</p>}

                    <div className="mb-3 rounded bg-slate-700 p-3">
                      <p className="mb-2 text-sm font-semibold">Efectos</p>

                      {newEffect?.optionId === opt.id ? (
                        <form onSubmit={(e) => handleAddEffect(e, opt.id)} className="mb-2 space-y-2">
                          <label htmlFor={`new-effect-type-${opt.id}`} className="block text-xs font-semibold text-slate-300">
                            Tipo
                          </label>
                          <select
                            id={`new-effect-type-${opt.id}`}
                            value={newEffect.type}
                            onChange={(e) => setNewEffect({ ...newEffect, type: e.target.value })}
                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                            required
                          >
                            <option value="">Tipo efecto</option>
                            <option value="modify_stat">Modify Stat</option>
                            <option value="set_flag">Set Flag</option>
                            <option value="add_item">Add Item</option>
                            <option value="remove_item">Remove Item</option>
                            <option value="modify_world_state">Modify World State</option>
                          </select>
                          <label htmlFor={`new-effect-key-${opt.id}`} className="block text-xs font-semibold text-slate-300">
                            Key
                          </label>
                          <input
                            id={`new-effect-key-${opt.id}`}
                            type="text"
                            placeholder="Key"
                            value={newEffect.key}
                            onChange={(e) => setNewEffect({ ...newEffect, key: e.target.value })}
                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white placeholder-slate-500"
                            required
                          />
                          <label htmlFor={`new-effect-value-${opt.id}`} className="block text-xs font-semibold text-slate-300">
                            Value
                          </label>
                          <input
                            id={`new-effect-value-${opt.id}`}
                            type="text"
                            placeholder="Value"
                            value={newEffect.value}
                            onChange={(e) => setNewEffect({ ...newEffect, value: e.target.value })}
                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white placeholder-slate-500"
                            required
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                            >
                              Agregar
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewEffect(null)}
                              className="flex-1 rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-700"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setNewEffect({ optionId: opt.id, type: "", key: "", value: "" })}
                          className="mb-2 w-full rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500"
                        >
                          + Efecto
                        </button>
                      )}

                      <div className="space-y-1">
                        {opt.effects?.map((eff) => (
                          <div key={eff.id} className="flex items-center justify-between rounded bg-slate-600 p-2 text-xs">
                            <span>
                              {eff.type}: {eff.key} = {String(eff.value)}
                            </span>
                            <button
                              onClick={() => handleDeleteEffect(eff.id!)}
                              className="rounded bg-red-600 px-1 py-0.5 text-white hover:bg-red-700"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
