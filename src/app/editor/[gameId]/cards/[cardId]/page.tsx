"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  createCondition,
  createEffect,
  createOption,
  deleteCondition,
  deleteEffect,
  deleteOption,
  fetchCardById,
  fetchCardsByDeckId,
  fetchFlagKeysByGameId,
  fetchStatsByGameId,
  fetchWorldStatesByGameId,
  updateCard,
  updateCondition,
  updateEffect,
  updateOption,
} from "@/app/actions"
import type { ConditionType } from "@/lib/domain"
import type { CardWithRelations } from "@/lib/services/prisma/cards"
import type { OptionWithEffects } from "@/lib/services/prisma/options"
import ConfirmModal from "@/components/editor/ConfirmModal"
import PathTrail from "@/components/editor/PathTrail"

type CardType = "decision" | "narrative" | "interactive"

type DraftCondition = {
  id?: string
  type: ConditionType
  key: string
  value: string
}

type DraftEffect = {
  id?: string
  type: string
  key: string
  value: string
}

type DraftOption = {
  id?: string
  text: string
  order: number
  nextCardId: string
  effects: DraftEffect[]
}

type DeleteTarget =
  | { kind: "condition"; id?: string; index?: number }
  | { kind: "option"; id?: string; index?: number }
  | { kind: "effect"; optionIndex: number; effectIndex: number }

type NextCardPreview = {
  id: string
  title: string
  description: string
  type: string
  priority: number
}

function TrashButton({
  onClick,
  title,
  disabled,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded-md border border-red-400/50 p-1.5 text-red-300 transition-colors hover:bg-red-600/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 6h18" />
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  )
}

function NextCardPreviewPanel({
  card,
  label,
}: {
  card: NextCardPreview | null
  label: string
}) {
  if (!card) return null

  return (
    <div className="mt-2 rounded-md border border-slate-600 bg-slate-900/70 p-3">
      <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-100">{card.title}</p>
      <p className="mt-1 text-xs text-slate-400">
        Tipo: {card.type} · Nivel sugerido: {card.priority}
      </p>
      <p className="mt-2 line-clamp-2 text-xs text-slate-300">
        {card.description || "Sin descripcion"}
      </p>
    </div>
  )
}

function toDraftCondition(condition: {
  id?: string
  type: string
  key: string
  value: string
}): DraftCondition {
  return {
    id: condition.id,
    type: condition.type as ConditionType,
    key: condition.key,
    value: condition.value ?? "",
  }
}

function toDraftOption(option: OptionWithEffects): DraftOption {
  return {
    id: option.id,
    text: option.text,
    order: option.order,
    nextCardId: option.nextCardId || "",
    effects: (option.effects || []).map((effect) => ({
      id: effect.id,
      type: effect.type,
      key: effect.key,
      value: String(effect.value ?? ""),
    })),
  }
}

export default function CardPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const cardId = params.cardId as string

  const [card, setCard] = useState<CardWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [editingCard, setEditingCard] = useState(false)
  const [cardForm, setCardForm] = useState({
    title: "",
    type: "narrative" as CardType,
    description: "",
    tags: "",
  })

  const [baseConditions, setBaseConditions] = useState<DraftCondition[]>([])
  const [baseOptions, setBaseOptions] = useState<DraftOption[]>([])

  const [draftConditions, setDraftConditions] = useState<DraftCondition[]>([])
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>([])

  const [newCondition, setNewCondition] = useState<{ type: ConditionType | ""; key: string; value: string }>({
    type: "",
    key: "",
    value: "",
  })
  const [newOption, setNewOption] = useState({ text: "", nextCardId: "" })

  const [expandedOptionIndexes, setExpandedOptionIndexes] = useState<number[]>([])

  const [newEffect, setNewEffect] = useState<{ optionIndex: number; type: string; key: string; value: string } | null>(
    null
  )

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; target: DeleteTarget | null }>({
    open: false,
    target: null,
  })

  const [statKeys, setStatKeys] = useState<string[]>([])
  const [worldStateKeys, setWorldStateKeys] = useState<string[]>([])
  const [flagKeys, setFlagKeys] = useState<string[]>([])
  const [availableNextCards, setAvailableNextCards] = useState<NextCardPreview[]>([])

  const nextCardMap = useMemo(() => {
    return new Map(availableNextCards.map((item) => [item.id, item]))
  }, [availableNextCards])

  const conditionKeyOptions = useMemo(() => {
    if (newCondition.type === "stat_min" || newCondition.type === "stat_max") {
      return statKeys
    }

    if (newCondition.type === "world_state") {
      return worldStateKeys
    }

    if (newCondition.type === "flag" || newCondition.type === "not_flag") {
      return flagKeys
    }

    return []
  }, [flagKeys, newCondition.type, statKeys, worldStateKeys])

  const selectedNextCardPreview = useMemo(() => {
    if (!newOption.nextCardId) return null
    return nextCardMap.get(newOption.nextCardId) || null
  }, [newOption.nextCardId, nextCardMap])

  useEffect(() => {
    void loadCardAndRefs()
  }, [cardId])

  async function loadReferences(deckId: string) {
    const [stats, worldStates, flags, deckCards] = await Promise.all([
      fetchStatsByGameId(gameId),
      fetchWorldStatesByGameId(gameId),
      fetchFlagKeysByGameId(gameId),
      fetchCardsByDeckId(deckId),
    ])

    setStatKeys(stats.map((stat) => stat.key))
    setWorldStateKeys(worldStates.map((ws) => ws.key))
    setFlagKeys(flags)
    setAvailableNextCards(
      deckCards
        .filter((deckCard) => deckCard.id !== cardId)
        .map((deckCard) => ({
          id: deckCard.id,
          title: deckCard.title,
          description: deckCard.description,
          type: deckCard.type,
          priority: deckCard.priority,
        }))
    )
  }

  async function loadCardAndRefs() {
    try {
      setIsLoading(true)
      const cardData = await fetchCardById(cardId)
      if (!cardData) return

      setCard(cardData as CardWithRelations)
      setCardForm({
        title: cardData.title,
        type: cardData.type as CardType,
        description: cardData.description,
        tags: cardData.tags.join(", "),
      })

      const initialConditions = (cardData.conditions || []).map((condition) =>
        toDraftCondition({
          id: condition.id,
          type: condition.type,
          key: condition.key,
          value: condition.value,
        })
      )

      const initialOptions = (cardData.options || []).map((option) => toDraftOption(option as OptionWithEffects))

      setBaseConditions(initialConditions)
      setBaseOptions(initialOptions)
      setDraftConditions(initialConditions)
      setDraftOptions(initialOptions)

      await loadReferences(cardData.deckId)
    } catch (error) {
      console.error("Error loading card:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function resetDraftsToBase() {
    setDraftConditions(baseConditions)
    setDraftOptions(baseOptions)
    setNewCondition({ type: "", key: "", value: "" })
    setNewOption({ text: "", nextCardId: "" })
    setNewEffect(null)
    setExpandedOptionIndexes([])

    if (card) {
      setCardForm({
        title: card.title,
        type: card.type as CardType,
        description: card.description,
        tags: card.tags.join(", "),
      })
    }
  }

  function handleEditToggle() {
    if (editingCard) {
      resetDraftsToBase()
    }
    setEditingCard((prev) => !prev)
  }

  function requestDelete(target: DeleteTarget) {
    if (!editingCard) return
    setDeleteModal({ open: true, target })
  }

  function confirmDeleteInDraft() {
    const target = deleteModal.target
    if (!target) return

    if (target.kind === "condition") {
      setDraftConditions((prev) => {
        if (typeof target.index === "number") {
          return prev.filter((_, index) => index !== target.index)
        }
        return prev.filter((condition) => condition.id !== target.id)
      })
    }

    if (target.kind === "option") {
      setDraftOptions((prev) => {
        if (typeof target.index === "number") {
          return prev.filter((_, index) => index !== target.index)
        }
        return prev.filter((option) => option.id !== target.id)
      })
    }

    if (target.kind === "effect") {
      setDraftOptions((prev) =>
        prev.map((option, optionIndex) => {
          if (optionIndex !== target.optionIndex) return option
          return {
            ...option,
            effects: option.effects.filter((_, effectIndex) => effectIndex !== target.effectIndex),
          }
        })
      )
    }

    setDeleteModal({ open: false, target: null })
  }

  function addConditionDraft(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCard) return

    const type = newCondition.type.trim() as ConditionType
    const key = newCondition.key.trim()
    const value = newCondition.value.trim()

    if (!type || !key) return

    if ((type === "stat_min" || type === "stat_max" || type === "world_state") && !value) {
      return
    }

    setDraftConditions((prev) => [...prev, { type, key, value }])
    setNewCondition({ type: "", key: "", value: "" })
  }

  function addOptionDraft(e: React.FormEvent) {
    e.preventDefault()
    if (!editingCard) return
    if (cardForm.type === "interactive") return
    if (cardForm.type === "decision" && draftOptions.length >= 2) return
    if (cardForm.type === "narrative" && draftOptions.length >= 1) return

    const text = cardForm.type === "decision" ? newOption.text.trim() : "Continuar"
    if (cardForm.type === "decision" && !text) return

    setDraftOptions((prev) => [
      ...prev,
      {
        text,
        order: prev.length + 1,
        nextCardId: newOption.nextCardId.trim(),
        effects: [],
      },
    ])

    setNewOption({ text: "", nextCardId: "" })
  }

  function addEffectDraft(e: React.FormEvent, optionIndex: number) {
    e.preventDefault()
    if (!editingCard) return
    if (!newEffect || newEffect.optionIndex !== optionIndex) return

    const type = newEffect.type.trim()
    const key = newEffect.key.trim()
    const value = newEffect.value.trim()
    if (!type || !key || !value) return

    setDraftOptions((prev) =>
      prev.map((option, index) => {
        if (index !== optionIndex) return option
        return {
          ...option,
          effects: [...option.effects, { type, key, value }],
        }
      })
    )

    setNewEffect(null)
  }

  function updateOptionDraft(optionIndex: number, patch: Partial<DraftOption>) {
    setDraftOptions((prev) => prev.map((option, idx) => (idx === optionIndex ? { ...option, ...patch } : option)))
  }

  async function saveAllChanges() {
    if (!card || !editingCard) return

    const title = cardForm.title.trim()
    if (!title) return

    if (cardForm.type === "interactive") return

    if (cardForm.type === "decision" && draftOptions.length > 2) return
    if (cardForm.type === "narrative" && draftOptions.length > 1) return

    try {
      setIsSaving(true)

      await updateCard(card.id, {
        title,
        type: cardForm.type,
        description: cardForm.description.trim(),
        tags: cardForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      const draftConditionIds = new Set(draftConditions.map((condition) => condition.id).filter(Boolean) as string[])

      for (const baseCondition of baseConditions) {
        if (baseCondition.id && !draftConditionIds.has(baseCondition.id)) {
          await deleteCondition(baseCondition.id)
        }
      }

      for (const condition of draftConditions) {
        const payload = {
          type: condition.type,
          key: condition.key.trim(),
          value:
            condition.type === "flag" || condition.type === "not_flag"
              ? undefined
              : condition.value.trim(),
        }

        if (condition.id) {
          await updateCondition(condition.id, payload)
        } else {
          await createCondition(card.id, payload)
        }
      }

      const draftOptionIds = new Set(draftOptions.map((option) => option.id).filter(Boolean) as string[])

      for (const baseOption of baseOptions) {
        if (baseOption.id && !draftOptionIds.has(baseOption.id)) {
          await deleteOption(baseOption.id)
        }
      }

      for (let optionIndex = 0; optionIndex < draftOptions.length; optionIndex += 1) {
        const optionDraft = draftOptions[optionIndex]

        let optionId = optionDraft.id
        const optionPayload = {
          text: (cardForm.type === "narrative" ? "Continuar" : optionDraft.text).trim(),
          order: optionIndex + 1,
          nextCardId: optionDraft.nextCardId.trim() || null,
        }

        if (!optionPayload.text) {
          continue
        }

        if (optionId) {
          await updateOption(optionId, optionPayload)
        } else {
          const createdOption = await createOption({
            cardId: card.id,
            text: optionPayload.text,
            order: optionPayload.order,
            nextCardId: optionPayload.nextCardId || undefined,
          })
          optionId = createdOption.id
        }

        const baseOption = optionDraft.id
          ? baseOptions.find((option) => option.id === optionDraft.id)
          : undefined

        const draftEffectIds = new Set(optionDraft.effects.map((effect) => effect.id).filter(Boolean) as string[])

        for (const baseEffect of baseOption?.effects || []) {
          if (baseEffect.id && !draftEffectIds.has(baseEffect.id)) {
            await deleteEffect(baseEffect.id)
          }
        }

        for (const effect of optionDraft.effects) {
          const effectPayload = {
            type: effect.type.trim(),
            key: effect.key.trim(),
            value: effect.value.trim(),
          }

          if (!effectPayload.type || !effectPayload.key || !effectPayload.value) {
            continue
          }

          if (effect.id) {
            await updateEffect(effect.id, effectPayload)
          } else if (optionId) {
            await createEffect(optionId, effectPayload)
          }
        }
      }

      setEditingCard(false)
      await loadCardAndRefs()
    } catch (error) {
      console.error("Error saving card changes:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>
  if (!card) return <div className="p-8">Carta no encontrada</div>

  return (
    <div className="max-w-6xl p-8">
      <section className="mb-8">
        <PathTrail
          items={[
            { label: "Editor", href: "/editor" },
            { label: "Decks", href: `/editor/${gameId}` },
            { label: "Cartas", href: `/editor/${gameId}/decks/${card.deckId}` },
            { label: card.title },
          ]}
          maxVisible={5}
        />
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-4xl font-bold">{cardForm.title || card.title}</h1>
          {!editingCard && (
            <button
              type="button"
              onClick={handleEditToggle}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Editar Carta
            </button>
          )}
        </div>

        {editingCard ? (
          <div className="space-y-4 rounded bg-slate-800 p-6">
            <div>
              <label htmlFor="edit-card-title" className="mb-2 block text-sm font-semibold text-slate-200">
                Titulo
              </label>
              <input
                id="edit-card-title"
                type="text"
                value={cardForm.title}
                onChange={(e) => setCardForm((prev) => ({ ...prev, title: e.target.value }))}
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
                onChange={(e) => setCardForm((prev) => ({ ...prev, type: e.target.value as CardType }))}
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
              <label htmlFor="edit-card-description" className="mb-2 block text-sm font-semibold text-slate-200">
                Descripcion
              </label>
              <textarea
                id="edit-card-description"
                value={cardForm.description}
                onChange={(e) => setCardForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                rows={3}
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
                onChange={(e) => setCardForm((prev) => ({ ...prev, tags: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                placeholder="Tags separadas por coma"
              />
            </div>
          </div>
        ) : (
          <div className="rounded bg-slate-800 p-6">
            <p className="mb-2 text-slate-300">{cardForm.description || card.description}</p>
            <div className="flex gap-4 text-sm text-slate-400">
              <span>Tipo: {cardForm.type || card.type}</span>
              <span>Conexiones: {draftOptions.length}</span>
            </div>
            {card.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <span
                    key={`${card.id}-${tag}`}
                    className="rounded-full border border-slate-600 bg-slate-700/60 px-2 py-1 text-xs text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-8">
        <section>
          <h2 className="mb-4 text-2xl font-bold">Condiciones</h2>

          <form onSubmit={addConditionDraft} className="mb-4 rounded bg-slate-800 p-4">
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
                  key: "",
                  value: e.target.value === "flag" || e.target.value === "not_flag" ? "" : prev.value,
                }))
              }
              disabled={!editingCard}
              className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
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
            <select
              id="new-condition-key"
              value={newCondition.key}
              onChange={(e) => setNewCondition((prev) => ({ ...prev, key: e.target.value }))}
              disabled={!editingCard || !newCondition.type || conditionKeyOptions.length === 0}
              className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
            >
              <option value="">{newCondition.type ? "Selecciona key" : "Selecciona tipo primero"}</option>
              {conditionKeyOptions.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>

            {(newCondition.type === "stat_min" || newCondition.type === "stat_max" || newCondition.type === "world_state") && (
              <>
                <label htmlFor="new-condition-value" className="mb-1 block text-xs font-semibold text-slate-300">
                  {newCondition.type === "world_state" ? "Value" : "Value numerico"}
                </label>
                <input
                  id="new-condition-value"
                  type={newCondition.type === "world_state" ? "text" : "number"}
                  placeholder="0"
                  value={newCondition.value}
                  onChange={(e) => setNewCondition((prev) => ({ ...prev, value: e.target.value }))}
                  disabled={!editingCard}
                  className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
                />
              </>
            )}

            <button
              type="submit"
              disabled={!editingCard}
              className="w-full rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Agregar
            </button>
          </form>

          <div className="space-y-2">
            {draftConditions.map((condition, index) => (
              <div key={`${condition.id || "new"}-${index}`} className="flex items-center justify-between rounded bg-slate-800 p-3">
                <div className="text-sm">
                  <p className="font-semibold">{condition.type}</p>
                  {condition.type === "flag" || condition.type === "not_flag" ? (
                    <p className="text-slate-400">{condition.key}</p>
                  ) : (
                    <p className="text-slate-400">
                      {condition.key}: {condition.value}
                    </p>
                  )}
                </div>

                <TrashButton
                  onClick={() =>
                    requestDelete(
                      condition.id
                        ? { kind: "condition", id: condition.id }
                        : { kind: "condition", index }
                    )
                  }
                  title="Eliminar condicion"
                  disabled={!editingCard}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">Opciones</h2>

          {cardForm.type === "interactive" ? (
            <div className="rounded bg-slate-800 p-4 text-sm text-slate-300">
              Esta carta es interactiva. La edicion de opciones y efectos no esta habilitada.
            </div>
          ) : (
            <>
              {(cardForm.type === "narrative" ? draftOptions.length < 1 : draftOptions.length < 2) ? (
                <form onSubmit={addOptionDraft} className="mb-4 rounded bg-slate-800 p-4">
                  {cardForm.type === "decision" && (
                    <>
                      <label htmlFor="new-option-text" className="mb-1 block text-xs font-semibold text-slate-300">
                        Texto de la opcion
                      </label>
                      <input
                        id="new-option-text"
                        type="text"
                        value={newOption.text}
                        onChange={(e) => setNewOption((prev) => ({ ...prev, text: e.target.value }))}
                        disabled={!editingCard}
                        className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
                      />
                    </>
                  )}

                  <label htmlFor="new-option-next-card" className="mb-1 block text-xs font-semibold text-slate-300">
                    {cardForm.type === "narrative" ? "Siguiente carta (opcional)" : "Siguiente carta"}
                  </label>
                  <select
                    id="new-option-next-card"
                    value={newOption.nextCardId}
                    onChange={(e) => setNewOption((prev) => ({ ...prev, nextCardId: e.target.value }))}
                    disabled={!editingCard}
                    className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
                  >
                    <option value="">Sin destino</option>
                    {availableNextCards.map((nextCard) => (
                      <option key={nextCard.id} value={nextCard.id}>
                        {nextCard.title}
                      </option>
                    ))}
                  </select>

                  <NextCardPreviewPanel card={selectedNextCardPreview} label="Preview estilo notas" />

                  <button
                    type="submit"
                    disabled={!editingCard}
                    className="mt-3 w-full rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cardForm.type === "narrative" ? "Guardar conexion narrativa" : "Agregar opcion"}
                  </button>
                </form>
              ) : (
                <p className="mb-4 rounded border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">
                  {cardForm.type === "narrative"
                    ? "Esta carta narrativa ya tiene una conexion. Eliminala para cambiarla."
                    : "Esta carta ya tiene 2 opciones. Elimina una para poder agregar otra."}
                </p>
              )}

              <div className="space-y-4">
                {draftOptions.map((option, optionIndex) => {
                  const isExpanded = expandedOptionIndexes.includes(optionIndex)
                  const optionPreview = option.nextCardId ? nextCardMap.get(option.nextCardId) || null : null

                  return (
                    <div key={`${option.id || "new-option"}-${optionIndex}`} className="rounded border border-slate-700 bg-slate-800 p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOptionIndexes((prev) =>
                              prev.includes(optionIndex)
                                ? prev.filter((idx) => idx !== optionIndex)
                                : [...prev, optionIndex]
                            )
                          }
                          className="flex flex-1 items-center justify-between rounded border border-slate-600 bg-slate-700/70 px-3 py-2 text-left text-sm font-semibold text-slate-100"
                        >
                          <span>{cardForm.type === "narrative" ? "Conexion narrativa" : option.text || "Opcion sin texto"}</span>
                          <span className="text-xs text-slate-300">{isExpanded ? "Ocultar" : "Abrir"}</span>
                        </button>

                        <TrashButton
                          onClick={() =>
                            requestDelete(
                              option.id
                                ? { kind: "option", id: option.id }
                                : { kind: "option", index: optionIndex }
                            )
                          }
                          title="Eliminar opcion"
                          disabled={!editingCard}
                        />
                      </div>

                      {isExpanded && (
                        <div className="mb-3">
                          {cardForm.type === "decision" && (
                            <>
                              <label className="mb-1 block text-xs font-semibold text-slate-300">Texto de opcion</label>
                              <input
                                value={option.text}
                                onChange={(e) => updateOptionDraft(optionIndex, { text: e.target.value })}
                                className="mb-2 w-full rounded bg-slate-700 px-2 py-1 text-sm text-white"
                              />
                            </>
                          )}

                          <label className="mb-1 block text-xs font-semibold text-slate-300">Siguiente carta</label>
                          <select
                            value={option.nextCardId}
                            onChange={(e) => updateOptionDraft(optionIndex, { nextCardId: e.target.value })}
                            className="w-full rounded bg-slate-700 px-2 py-1 text-sm text-white"
                          >
                            <option value="">Sin destino</option>
                            {availableNextCards.map((nextCard) => (
                              <option key={nextCard.id} value={nextCard.id}>
                                {nextCard.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <NextCardPreviewPanel card={optionPreview} label="Siguiente carta" />

                      <div className="mt-3 rounded bg-slate-700 p-3">
                        <p className="mb-2 text-sm font-semibold">Efectos</p>

                        {newEffect?.optionIndex === optionIndex ? (
                          <form onSubmit={(e) => addEffectDraft(e, optionIndex)} className="mb-2 space-y-2">
                            <select
                              value={newEffect.type}
                              onChange={(e) => setNewEffect({ ...newEffect, type: e.target.value })}
                              className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                            >
                              <option value="">Tipo efecto</option>
                              <option value="modify_stat">Modify Stat</option>
                              <option value="set_flag">Set Flag</option>
                              <option value="add_item">Add Item</option>
                              <option value="remove_item">Remove Item</option>
                              <option value="modify_world_state">Modify World State</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Key"
                              value={newEffect.key}
                              onChange={(e) => setNewEffect({ ...newEffect, key: e.target.value })}
                              className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                            />
                            <input
                              type="text"
                              placeholder="Value"
                              value={newEffect.value}
                              onChange={(e) => setNewEffect({ ...newEffect, value: e.target.value })}
                              className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                            />
                            <div className="flex gap-2">
                              <button type="submit" className="flex-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">
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
                            type="button"
                            disabled={!editingCard}
                            onClick={() => setNewEffect({ optionIndex, type: "", key: "", value: "" })}
                            className="mb-2 w-full rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            + Efecto
                          </button>
                        )}

                        <div className="space-y-1">
                          {option.effects.map((effect, effectIndex) => (
                            <div key={`${effect.id || "new-eff"}-${effectIndex}`} className="flex items-center justify-between rounded bg-slate-600 p-2 text-xs">
                              <span>
                                {effect.type}: {effect.key} = {effect.value}
                              </span>
                              <TrashButton
                                onClick={() =>
                                  requestDelete({
                                    kind: "effect",
                                    optionIndex,
                                    effectIndex,
                                  })
                                }
                                title="Eliminar efecto"
                                disabled={!editingCard}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="mt-8 flex justify-end gap-2">
        {editingCard ? (
          <>
            <button
              type="button"
              onClick={handleEditToggle}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void saveAllChanges()}
              disabled={isSaving}
              className="rounded border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Guardando todo..." : "Guardar todo"}
            </button>
          </>
        ) : null}
      </div>

      <ConfirmModal
        open={deleteModal.open}
        title={
          deleteModal.target?.kind === "condition"
            ? "Quitar condicion"
            : deleteModal.target?.kind === "option"
              ? "Quitar opcion"
              : "Quitar efecto"
        }
        message={
          deleteModal.target?.kind === "condition"
            ? "Se quitara la condicion del borrador actual. Se aplicara al guardar."
            : deleteModal.target?.kind === "option"
              ? "Se quitara la opcion (y sus efectos) del borrador actual. Se aplicara al guardar."
              : "Se quitara el efecto del borrador actual. Se aplicara al guardar."
        }
        confirmLabel="Quitar"
        onConfirm={confirmDeleteInDraft}
        onCancel={() => setDeleteModal({ open: false, target: null })}
      />
    </div>
  )
}
