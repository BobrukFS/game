"use client"

import Link from "next/link"
import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  createCard,
  createCondition,
  createEffect,
  createOption,
  fetchCardsByDeckId,
} from "@/app/actions"
import type { ConditionType } from "@/lib/domain"
import type { DeckCardType } from "@/components/editor/deck/types"

type DraftCondition = {
  type: ConditionType | ""
  key: string
  value: string
}

type DraftEffect = {
  type: string
  key: string
  value: string
}

type DraftOption = {
  text: string
  nextCardId: string
  effects: DraftEffect[]
}

export default function DeckCreateCardPageForm({
  gameId,
  deckId,
}: {
  gameId: string
  deckId: string
}) {
  const router = useRouter()

  const [isSaving, setIsSaving] = useState(false)
  const [existingCards, setExistingCards] = useState<{ id: string; title: string }[]>([])

  const [cardData, setCardData] = useState({
    title: "",
    type: "narrative" as DeckCardType,
    description: "",
    tags: "",
  })

  const [conditions, setConditions] = useState<DraftCondition[]>([])
  const [options, setOptions] = useState<DraftOption[]>([])

  const isDecision = cardData.type === "decision"

  useEffect(() => {
    let mounted = true

    async function loadCards() {
      try {
        const cards = await fetchCardsByDeckId(deckId)
        if (!mounted) return
        setExistingCards(cards.map((card) => ({ id: card.id, title: card.title })))
      } catch (error) {
        console.error("Error loading cards for create page:", error)
      }
    }

    void loadCards()

    return () => {
      mounted = false
    }
  }, [deckId])

  function addCondition() {
    setConditions((prev) => [...prev, { type: "", key: "", value: "" }])
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCondition(index: number, patch: Partial<DraftCondition>) {
    setConditions((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addOption() {
    if (options.length >= 2) return
    setOptions((prev) => [...prev, { text: "", nextCardId: "", effects: [] }])
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  function updateOption(index: number, patch: Partial<DraftOption>) {
    setOptions((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addEffect(optionIndex: number) {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === optionIndex
          ? { ...option, effects: [...option.effects, { type: "", key: "", value: "" }] }
          : option
      )
    )
  }

  function removeEffect(optionIndex: number, effectIndex: number) {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === optionIndex
          ? { ...option, effects: option.effects.filter((_, eIdx) => eIdx !== effectIndex) }
          : option
      )
    )
  }

  function updateEffect(optionIndex: number, effectIndex: number, patch: Partial<DraftEffect>) {
    setOptions((prev) =>
      prev.map((option, i) => {
        if (i !== optionIndex) return option
        return {
          ...option,
          effects: option.effects.map((effect, eIdx) =>
            eIdx === effectIndex ? { ...effect, ...patch } : effect
          ),
        }
      })
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const title = cardData.title.trim()
    if (!title) return

    if (cardData.type === "interactive") {
      return
    }

    if (isDecision && options.length !== 2) {
      return
    }

    if (isDecision && options.some((option) => !option.text.trim())) {
      return
    }

    try {
      setIsSaving(true)

      const card = await createCard({
        deckId,
        title,
        type: cardData.type,
        description: cardData.description.trim(),
        priority: existingCards.length + 1,
        tags: cardData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      for (const condition of conditions) {
        if (!condition.type || !condition.key.trim()) continue

        await createCondition(card.id, {
          type: condition.type,
          key: condition.key.trim(),
          value:
            condition.type === "flag" || condition.type === "not_flag"
              ? undefined
              : condition.value.trim(),
        })
      }

      if (isDecision) {
        for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
          const optionDraft = options[optionIndex]
          const createdOption = await createOption({
            cardId: card.id,
            text: optionDraft.text.trim(),
            order: optionIndex + 1,
            nextCardId: optionDraft.nextCardId.trim() || undefined,
          })

          for (const effect of optionDraft.effects) {
            if (!effect.type.trim() || !effect.key.trim() || !effect.value.trim()) {
              continue
            }

            await createEffect(createdOption.id, {
              type: effect.type.trim(),
              key: effect.key.trim(),
              value: effect.value.trim(),
            })
          }
        }
      }

      router.push(`/editor/${gameId}/cards/${card.id}`)
    } catch (error) {
      console.error("Error creating full card from create page:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-8 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nueva carta</h1>
          <p className="mt-1 text-sm text-slate-400">
            Crea la carta completa con condiciones, opciones y efectos.
          </p>
        </div>
        <Link
          href={`/editor/${gameId}/decks/${deckId}`}
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Volver a cartas
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-lg border border-slate-700 bg-slate-800/70 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Datos de carta</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="create-card-title" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Titulo
              </label>
              <input
                id="create-card-title"
                value={cardData.title}
                onChange={(e) => setCardData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="create-card-type" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tipo
              </label>
              <select
                id="create-card-type"
                value={cardData.type}
                onChange={(e) => setCardData((prev) => ({ ...prev, type: e.target.value as DeckCardType }))}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="narrative">Narrativo</option>
                <option value="decision">Decision</option>
                <option value="interactive" disabled>
                  Interactivo (no habilitado)
                </option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="create-card-description" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Descripcion
              </label>
              <textarea
                id="create-card-description"
                value={cardData.description}
                onChange={(e) => setCardData((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="create-card-tags" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tags
              </label>
              <input
                id="create-card-tags"
                value={cardData.tags}
                onChange={(e) => setCardData((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="separadas por coma"
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-800/70 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Condiciones</h2>
            <button
              type="button"
              onClick={addCondition}
              className="rounded border border-slate-600 px-3 py-1 text-xs font-semibold hover:bg-slate-700"
            >
              + Agregar condicion
            </button>
          </div>

          <div className="space-y-3">
            {conditions.length === 0 && <p className="text-sm text-slate-500">Sin condiciones.</p>}
            {conditions.map((condition, index) => (
              <div key={`condition-${index}`} className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Condicion #{index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="rounded border border-red-400/50 px-2 py-1 text-xs text-red-300 hover:bg-red-600/20"
                  >
                    Quitar
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    value={condition.type}
                    onChange={(e) =>
                      updateCondition(index, {
                        type: e.target.value as ConditionType,
                        value:
                          e.target.value === "flag" || e.target.value === "not_flag"
                            ? ""
                            : condition.value,
                      })
                    }
                    className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="">Tipo</option>
                    <option value="stat_min">Stat Min</option>
                    <option value="stat_max">Stat Max</option>
                    <option value="flag">Flag</option>
                    <option value="not_flag">Not Flag</option>
                    <option value="world_state">World State</option>
                  </select>
                  <input
                    placeholder="Key"
                    value={condition.key}
                    onChange={(e) => updateCondition(index, { key: e.target.value })}
                    className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Value"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    disabled={condition.type === "flag" || condition.type === "not_flag"}
                    className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm disabled:opacity-60"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {isDecision && (
          <section className="rounded-lg border border-slate-700 bg-slate-800/70 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Opciones y efectos</h2>
              <button
                type="button"
                onClick={addOption}
                disabled={options.length >= 2}
                className="rounded border border-slate-600 px-3 py-1 text-xs font-semibold hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Agregar opcion
              </button>
            </div>

            <div className="space-y-3">
              {options.length === 0 && <p className="text-sm text-slate-500">Necesitas exactamente 2 opciones para cartas decision.</p>}
              {options.map((option, optionIndex) => (
                <div key={`option-${optionIndex}`} className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Opcion #{optionIndex + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeOption(optionIndex)}
                      className="rounded border border-red-400/50 px-2 py-1 text-xs text-red-300 hover:bg-red-600/20"
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      placeholder="Texto de opcion"
                      value={option.text}
                      onChange={(e) => updateOption(optionIndex, { text: e.target.value })}
                      className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                    />
                    <div>
                      <input
                        list={`existing-card-options-${optionIndex}`}
                        placeholder="Next Card ID (opcional)"
                        value={option.nextCardId}
                        onChange={(e) => updateOption(optionIndex, { nextCardId: e.target.value })}
                        className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                      />
                      <datalist id={`existing-card-options-${optionIndex}`}>
                        {existingCards.map((card) => (
                          <option key={card.id} value={card.id}>{card.title}</option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md border border-slate-700 bg-slate-950/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Efectos</p>
                      <button
                        type="button"
                        onClick={() => addEffect(optionIndex)}
                        className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-700"
                      >
                        + Efecto
                      </button>
                    </div>

                    <div className="space-y-2">
                      {option.effects.length === 0 && <p className="text-xs text-slate-500">Sin efectos.</p>}
                      {option.effects.map((effect, effectIndex) => (
                        <div key={`effect-${optionIndex}-${effectIndex}`} className="grid gap-2 md:grid-cols-4">
                          <select
                            value={effect.type}
                            onChange={(e) => updateEffect(optionIndex, effectIndex, { type: e.target.value })}
                            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs"
                          >
                            <option value="">Tipo</option>
                            <option value="modify_stat">Modify Stat</option>
                            <option value="set_flag">Set Flag</option>
                            <option value="add_item">Add Item</option>
                            <option value="remove_item">Remove Item</option>
                            <option value="modify_world_state">Modify World State</option>
                          </select>
                          <input
                            placeholder="Key"
                            value={effect.key}
                            onChange={(e) => updateEffect(optionIndex, effectIndex, { key: e.target.value })}
                            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs"
                          />
                          <input
                            placeholder="Value"
                            value={effect.value}
                            onChange={(e) => updateEffect(optionIndex, effectIndex, { value: e.target.value })}
                            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => removeEffect(optionIndex, effectIndex)}
                            className="rounded-md border border-red-400/50 px-2 py-1.5 text-xs text-red-300 hover:bg-red-600/20"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Creando..." : "Crear carta completa"}
        </button>
      </form>
    </div>
  )
}
