"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
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
import type { ConditionDataType, ConditionOperator } from "@/lib/domain/conditions"
import { getValidOperatorsForDataType, getOperatorLabel, getDataTypeLabel } from "@/lib/domain/conditions"
import type { CardWithRelations } from "@/lib/services/prisma/cards"
import type { OptionWithEffects } from "@/lib/services/prisma/options"
import ConfirmModal from "@/components/editor/ConfirmModal"
import PathTrail from "@/components/editor/PathTrail"

type CardType = "decision" | "narrative" | "interactive"

/**
 * Map legacy condition types (stat_min, stat_max, flag, not_flag, world_state)
 * to new (dataType, operator) pairs during schema transition
 */
function mapLegacyTypeToOperator(legacyType: string): ConditionOperator {
  const mapping: Record<string, ConditionOperator> = {
    stat_min: "min",
    stat_max: "max",
    flag: "equal",
    not_flag: "not_equal",
    world_state: "equal",
  }
  return mapping[legacyType] || "equal"
}

/**
 * Map legacy condition types to new dataTypes during schema transition
 */
function mapLegacyTypeToDataType(legacyType: string): ConditionDataType {
  const mapping: Record<string, ConditionDataType> = {
    stat_min: "stat",
    stat_max: "stat",
    flag: "flag",
    not_flag: "flag",
    world_state: "world_state",
  }
  return mapping[legacyType] || "stat"
}

type DraftCondition = {
  id?: string
  dataType: ConditionDataType
  operator: ConditionOperator
  key: string
  value: string
  logicOperator?: "AND" | "OR"
}

type DraftEffect = {
  id?: string
  type: string
  key: string
  value: string
}

type NewEffectDraft = {
  optionIndex: number
  type: "" | "modify_stat" | "modify_flag" | "modify_world_state"
  key: string
  // generic
  value: string
  // numeric
  mode: "set" | "increment" | "decrement"
  unit: "number" | "percent"
  amount: string
  // world array
  worldArrayMode: "add" | "remove" | "clear"
  item: string
  // flag
  flagMode: "set" | "remove"
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
  priority: number | null
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
        Tipo: {card.type} · Nivel sugerido: {card.priority ?? "Sin prioridad"}
      </p>
      <p className="mt-2 line-clamp-2 text-xs text-slate-300">
        {card.description || "Sin descripcion"}
      </p>
    </div>
  )
}

function toDraftCondition(condition: {
  id?: string
  dataType: string
  operator: string
  key: string
  value: string
  logicOperator?: string
}): DraftCondition {
  return {
    id: condition.id,
    dataType: condition.dataType as ConditionDataType,
    operator: condition.operator as ConditionOperator,
    key: condition.key,
    value: condition.value ?? "",
    logicOperator: (condition.logicOperator as "AND" | "OR") || "AND",
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

function createEmptyNewEffect(optionIndex: number): NewEffectDraft {
  return {
    optionIndex,
    type: "",
    key: "",
    value: "",
    mode: "increment",
    unit: "number",
    amount: "0",
    worldArrayMode: "add",
    item: "",
    flagMode: "set",
  }
}

function buildEffectValue(effect: NewEffectDraft, worldStateTypeMap: Record<string, string>): string {
  if (effect.type === "modify_stat") {
    return JSON.stringify({
      mode: effect.mode,
      unit: effect.unit,
      amount: Number(effect.amount || 0),
    })
  }

  if (effect.type === "modify_flag") {
    return JSON.stringify({
      mode: effect.flagMode,
    })
  }

  if (effect.type === "modify_world_state") {
    const valueType = worldStateTypeMap[effect.key]
    if (valueType === "array") {
      return JSON.stringify({
        targetType: "array",
        mode: effect.worldArrayMode,
        item: effect.worldArrayMode === "clear" ? undefined : effect.item,
      })
    }

    return JSON.stringify({
      targetType: "number",
      mode: effect.mode,
      unit: effect.unit,
      amount: Number(effect.amount || 0),
    })
  }

  return effect.value
}

function formatEffectPreview(effect: DraftEffect): string {
  try {
    const payload = JSON.parse(effect.value || "") as Record<string, any>

    if (effect.type === "modify_stat") {
      return `${effect.type}: ${effect.key} → ${payload.mode} ${payload.amount}${payload.unit === "percent" ? "%" : ""}`
    }

    if (effect.type === "modify_flag") {
      return `${effect.type}: ${effect.key} → ${payload.mode}`
    }

    if (effect.type === "modify_world_state") {
      if (payload.targetType === "array") {
        return `${effect.type}: ${effect.key} → ${payload.mode}${payload.item ? ` (${payload.item})` : ""}`
      }
      return `${effect.type}: ${effect.key} → ${payload.mode} ${payload.amount}${payload.unit === "percent" ? "%" : ""}`
    }
  } catch {
    // legacy plain-text values
  }

  return `${effect.type}: ${effect.key} = ${effect.value}`
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
    priority: "",
    priorityDisabled: true,
    tags: "",
  })

  const [baseConditions, setBaseConditions] = useState<DraftCondition[]>([])
  const [baseOptions, setBaseOptions] = useState<DraftOption[]>([])

  const [draftConditions, setDraftConditions] = useState<DraftCondition[]>([])
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>([])

  const [newCondition, setNewCondition] = useState<{ 
    dataType: ConditionDataType | ""
    operator: ConditionOperator | ""
    key: string
    value: string
    logicOperator: "AND" | "OR" 
  }>({
    dataType: "",
    operator: "",
    key: "",
    value: "",
    logicOperator: "AND",
  })
  const [newOption, setNewOption] = useState({ text: "", nextCardId: "" })

  const [expandedOptionIndexes, setExpandedOptionIndexes] = useState<number[]>([])

  const [newEffect, setNewEffect] = useState<NewEffectDraft | null>(null)

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; target: DeleteTarget | null }>({
    open: false,
    target: null,
  })

  const [statKeys, setStatKeys] = useState<string[]>([])
  const [worldStateKeys, setWorldStateKeys] = useState<string[]>([])
  const [worldStateTypeMap, setWorldStateTypeMap] = useState<Record<string, string>>({})
  const [worldStateEnumOptionsMap, setWorldStateEnumOptionsMap] = useState<Record<string, string[]>>({})
  const [worldStateEnumCurrentMap, setWorldStateEnumCurrentMap] = useState<Record<string, string>>({})
  const [flagKeys, setFlagKeys] = useState<string[]>([])
  const [availableNextCards, setAvailableNextCards] = useState<NextCardPreview[]>([])

  const nextCardMap = useMemo(() => {
    return new Map(availableNextCards.map((item) => [item.id, item]))
  }, [availableNextCards])

  const conditionKeyOptions = useMemo(() => {
    if (newCondition.dataType === "stat") {
      return statKeys
    }

    if (newCondition.dataType === "world_state") {
      return worldStateKeys
    }

    if (newCondition.dataType === "flag") {
      return flagKeys
    }

    return []
  }, [flagKeys, newCondition.dataType, statKeys, worldStateKeys])

  const selectedWorldStateType =
    newCondition.dataType === "world_state" && newCondition.key
      ? worldStateTypeMap[newCondition.key] || "string"
      : ""

  const selectedWorldEnumOptions =
    newCondition.dataType === "world_state" && selectedWorldStateType === "enum"
      ? worldStateEnumOptionsMap[newCondition.key] || []
      : []

  const conditionOperatorOptions = useMemo(() => {
    if (!newCondition.dataType) return []

    const base = getValidOperatorsForDataType(newCondition.dataType)
    if (newCondition.dataType === "world_state" && selectedWorldStateType === "enum") {
      return base.filter((operator) => operator === "equal" || operator === "not_equal")
    }

    return base
  }, [newCondition.dataType, selectedWorldStateType])

  const effectKeyOptions = useMemo(() => {
    if (!newEffect) return []

    if (newEffect.type === "modify_stat") {
      return statKeys
    }

    if (newEffect.type === "modify_flag") {
      return flagKeys
    }

    if (newEffect.type === "modify_world_state") {
      return worldStateKeys
    }

    return []
  }, [newEffect, statKeys, flagKeys, worldStateKeys])

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

    setStatKeys(stats.map((stat: { key: string }) => stat.key))
    setWorldStateKeys(worldStates.map((ws: { key: string }) => ws.key))
    setWorldStateTypeMap(
      Object.fromEntries(
        worldStates.map((ws: { key: string; valueType?: string }) => [ws.key, ws.valueType || "string"])
      )
    )
    const enumOptionsMap: Record<string, string[]> = {}
    const enumCurrentMap: Record<string, string> = {}

    worldStates.forEach((ws: { key: string; valueType?: string; value?: string }) => {
      if (ws.valueType !== "enum") return

      try {
        const parsed = JSON.parse(String(ws.value || "")) as { current?: unknown; options?: unknown }
        const options = Array.isArray(parsed?.options)
          ? parsed.options.map((option) => String(option).trim()).filter(Boolean)
          : []

        if (options.length === 0) return

        const requestedCurrent = String(parsed?.current ?? "").trim()
        const current = options.includes(requestedCurrent) ? requestedCurrent : options[0]
        enumOptionsMap[ws.key] = options
        enumCurrentMap[ws.key] = current
      } catch {
        // Ignore malformed enum world state payloads in editor helpers.
      }
    })

    setWorldStateEnumOptionsMap(enumOptionsMap)
    setWorldStateEnumCurrentMap(enumCurrentMap)
    setFlagKeys(flags)
    setAvailableNextCards(
      deckCards
        .filter((deckCard: { id: string }) => deckCard.id !== cardId)
        .map((deckCard: { id: string; title: string; description: string; type: string; priority: number | null }) => ({
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
        priority:
          typeof cardData.priority === "number" && Number.isFinite(cardData.priority)
            ? String(cardData.priority)
            : "",
        priorityDisabled: typeof cardData.priority !== "number" || !Number.isFinite(cardData.priority),
        tags: cardData.tags.join(", "),
      })

      const initialConditions = (cardData.conditions || []).map((condition: any) =>
        toDraftCondition({
          id: condition.id,
          dataType: condition.dataType || mapLegacyTypeToDataType(condition.type), // Support both old and new schema
          operator: condition.operator || mapLegacyTypeToOperator(condition.type), // Map old types
          key: condition.key,
          value: condition.value,
          logicOperator: condition.logicOperator,
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
    setNewCondition({ dataType: "", operator: "", key: "", value: "", logicOperator: "AND" })
    setNewOption({ text: "", nextCardId: "" })
    setNewEffect(null)
    setExpandedOptionIndexes([])

    if (card) {
      setCardForm({
        title: card.title,
        type: card.type as CardType,
        description: card.description,
        priority:
          typeof card.priority === "number" && Number.isFinite(card.priority)
            ? String(card.priority)
            : "",
        priorityDisabled: typeof card.priority !== "number" || !Number.isFinite(card.priority),
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

  const confirmDeleteInDraft = useCallback(() => {
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
  }, [deleteModal.target])

  const addConditionDraft = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCard) return

    const dataType = newCondition.dataType.trim() as ConditionDataType
    const operator = newCondition.operator.trim() as ConditionOperator
    const key = newCondition.key.trim()
    const value = newCondition.value.trim()

    if (!dataType || !operator || !key) return

    // Require value for stats and world states, not for boolean flags
    if ((dataType === "stat" || dataType === "world_state") && !value) {
      return
    }

    if (dataType === "world_state" && worldStateTypeMap[key] === "enum") {
      if (operator !== "equal" && operator !== "not_equal") {
        return
      }

      const allowed = worldStateEnumOptionsMap[key] || []
      if (allowed.length > 0 && !allowed.includes(value)) {
        return
      }
    }

    const nextCondition: DraftCondition = {
      dataType,
      operator,
      key,
      value,
    }

    // Only add logicOperator if there are already conditions
    if (draftConditions.length > 0) {
      nextCondition.logicOperator = newCondition.logicOperator
    }

    setDraftConditions((prev) => [...prev, nextCondition])
    setNewCondition({ dataType: "", operator: "", key: "", value: "", logicOperator: "AND" })
  }, [editingCard, newCondition, draftConditions, worldStateTypeMap, worldStateEnumOptionsMap])

  const addOptionDraft = useCallback((e: React.FormEvent) => {
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
  }, [editingCard, cardForm.type, draftOptions.length, newOption])

  const addEffectDraft = useCallback((e: React.FormEvent, optionIndex: number) => {
    e.preventDefault()
    if (!editingCard) return
    if (!newEffect || newEffect.optionIndex !== optionIndex) return

    const type = newEffect.type.trim()
    const key = newEffect.key.trim()
    
    if (!type || !key) return

    if (type === "modify_stat" && !newEffect.amount.trim()) return

    if (type === "modify_world_state") {
      const wsType = worldStateTypeMap[key]
      if (wsType === "array" && newEffect.worldArrayMode !== "clear" && !newEffect.item.trim()) {
        return
      }
      if (wsType !== "array" && !newEffect.amount.trim()) {
        return
      }
    }

    const value = buildEffectValue(newEffect, worldStateTypeMap)

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
  }, [editingCard, newEffect, worldStateTypeMap])

  function updateOptionDraft(optionIndex: number, patch: Partial<DraftOption>) {
    setDraftOptions((prev) => prev.map((option, idx) => (idx === optionIndex ? { ...option, ...patch } : option)))
  }

  async function saveCardOnly() {
    if (!card || !editingCard) return

    const title = cardForm.title.trim()
    if (!title) return
    const normalizedPriority = cardForm.priority.trim()
    if (!cardForm.priorityDisabled && normalizedPriority !== "" && !Number.isInteger(Number(normalizedPriority))) {
      return
    }

    try {
      setIsSaving(true)

      await updateCard(card.id, {
        title,
        type: cardForm.type,
        description: cardForm.description.trim(),
        priority:
          cardForm.priorityDisabled || normalizedPriority === ""
            ? null
            : Number(normalizedPriority),
        tags: cardForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      setEditingCard(false)
      await loadCardAndRefs()
    } catch (error) {
      console.error("Error saving card:", error)
    } finally {
      setIsSaving(false)
    }
  }

  async function saveAllChanges() {
    if (!card || !editingCard) return

    const title = cardForm.title.trim()
    if (!title) return
    const normalizedPriority = cardForm.priority.trim()
    if (!cardForm.priorityDisabled && normalizedPriority !== "" && !Number.isInteger(Number(normalizedPriority))) {
      return
    }

    if (cardForm.type === "interactive") return

    if (cardForm.type === "decision" && draftOptions.length > 2) return
    if (cardForm.type === "narrative" && draftOptions.length > 1) return

    try {
      setIsSaving(true)

      await updateCard(card.id, {
        title,
        type: cardForm.type,
        description: cardForm.description.trim(),
        priority:
          cardForm.priorityDisabled || normalizedPriority === ""
            ? null
            : Number(normalizedPriority),
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
          dataType: condition.dataType,
          operator: condition.operator,
          key: condition.key.trim(),
          value: condition.dataType === "flag" ? undefined : condition.value.trim(),
          logicOperator: condition.logicOperator || "AND",
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

            <div>
              <label htmlFor="edit-card-priority" className="mb-2 block text-sm font-semibold text-slate-200">
                Prioridad
              </label>
              <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={cardForm.priorityDisabled}
                  onChange={(e) =>
                    setCardForm((prev) => ({
                      ...prev,
                      priorityDisabled: e.target.checked,
                      priority:
                        e.target.checked
                          ? ""
                          : prev.priority.trim() === ""
                            ? "0"
                            : prev.priority,
                    }))
                  }
                />
                Sin prioridad
              </label>
              <input
                id="edit-card-priority"
                type="number"
                value={cardForm.priority}
                onChange={(e) => setCardForm((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                disabled={cardForm.priorityDisabled}
                placeholder="Sin prioridad"
              />
            </div>
          </div>
        ) : (
          <div className="rounded bg-slate-800 p-6">
            <p className="mb-2 text-slate-300">{cardForm.description || card.description}</p>
            <div className="flex gap-4 text-sm text-slate-400">
              <span>Tipo: {cardForm.type || card.type}</span>
              <span>Prioridad: {card.priority ?? "Sin prioridad"}</span>
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
            <label htmlFor="new-condition-datatype" className="mb-1 block text-xs font-semibold text-slate-300">
              Tipo de Dato
            </label>
            <select
              id="new-condition-datatype"
              value={newCondition.dataType}
              onChange={(e) =>
                setNewCondition((prev) => ({
                  ...prev,
                  dataType: e.target.value as ConditionDataType | "",
                  operator: "",
                  key: "",
                  value: "",
                }))
              }
              disabled={!editingCard}
              className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
            >
              <option value="">Selecciona tipo de dato</option>
              <option value="stat">{getDataTypeLabel("stat")}</option>
              <option value="flag">{getDataTypeLabel("flag")}</option>
              <option value="world_state">{getDataTypeLabel("world_state")}</option>
            </select>

            <label htmlFor="new-condition-key" className="mb-1 block text-xs font-semibold text-slate-300">
              Clave/Variable
            </label>
            <select
              id="new-condition-key"
              value={newCondition.key}
              onChange={(e) => {
                const nextKey = e.target.value
                const nextType = newCondition.dataType === "world_state"
                  ? worldStateTypeMap[nextKey] || "string"
                  : ""
                const nextOperatorOptions = newCondition.dataType
                  ? (newCondition.dataType === "world_state" && nextType === "enum"
                      ? getValidOperatorsForDataType("world_state").filter((operator) => operator === "equal" || operator === "not_equal")
                      : getValidOperatorsForDataType(newCondition.dataType))
                  : []
                const nextOperator = nextOperatorOptions.includes(newCondition.operator as ConditionOperator)
                  ? newCondition.operator
                  : (nextOperatorOptions[0] || "")
                const enumCurrent = worldStateEnumCurrentMap[nextKey] || ""
                const enumOptions = worldStateEnumOptionsMap[nextKey] || []
                const nextValue =
                  newCondition.dataType === "world_state" && nextType === "enum"
                    ? (enumOptions.includes(newCondition.value) ? newCondition.value : enumCurrent)
                    : newCondition.value

                setNewCondition((prev) => ({
                  ...prev,
                  key: nextKey,
                  operator: nextOperator,
                  value: nextValue,
                }))
              }}
              disabled={!editingCard || !newCondition.dataType || conditionKeyOptions.length === 0}
              className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
            >
              <option value="">
                {!newCondition.dataType
                  ? "Selecciona tipo de dato"
                  : conditionKeyOptions.length === 0
                    ? "No hay opciones disponibles"
                    : "Selecciona clave"}
              </option>
              {conditionKeyOptions.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>

            <label htmlFor="new-condition-operator" className="mb-1 block text-xs font-semibold text-slate-300">
              Operador
            </label>
            <select
              id="new-condition-operator"
              value={newCondition.operator}
              onChange={(e) =>
                setNewCondition((prev) => ({
                  ...prev,
                  operator: e.target.value as ConditionOperator | "",
                }))
              }
              disabled={!editingCard || !newCondition.dataType || !newCondition.key}
              className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
            >
              <option value="">
                {!newCondition.dataType
                  ? "Selecciona tipo de dato primero"
                  : !newCondition.key
                    ? "Selecciona variable primero"
                    : "Selecciona operador"}
              </option>
              {conditionOperatorOptions.map((op) => (
                  <option key={op} value={op}>
                    {getOperatorLabel(op as ConditionOperator)}
                  </option>
                ))}
            </select>

            {newCondition.dataType !== "flag" && (
              <>
                <label htmlFor="new-condition-value" className="mb-1 block text-xs font-semibold text-slate-300">
                  Valor {newCondition.dataType === "stat" ? "(numérico)" : ""}
                </label>
                {newCondition.dataType === "world_state" && selectedWorldStateType === "enum" ? (
                  <select
                    id="new-condition-value"
                    value={newCondition.value}
                    onChange={(e) => setNewCondition((prev) => ({ ...prev, value: e.target.value }))}
                    disabled={!editingCard || !newCondition.key || selectedWorldEnumOptions.length === 0}
                    className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
                  >
                    <option value="">Selecciona valor</option>
                    {selectedWorldEnumOptions.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="new-condition-value"
                    type={newCondition.dataType === "stat" ? "number" : "text"}
                    placeholder={newCondition.dataType === "stat" ? "0" : "valor"}
                    value={newCondition.value}
                    onChange={(e) => setNewCondition((prev) => ({ ...prev, value: e.target.value }))}
                    disabled={!editingCard || !newCondition.dataType}
                    className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
                  />
                )}
              </>
            )}

            {draftConditions.length > 0 && (
              <>
                <label htmlFor="condition-logic-next" className="mb-1 block text-xs font-semibold text-slate-300">
                  Conectar con próxima condición
                </label>
                <select
                  id="condition-logic-next"
                  value={newCondition.logicOperator}
                  onChange={(e) => setNewCondition((prev) => ({ ...prev, logicOperator: e.target.value as "AND" | "OR" }))}
                  disabled={!editingCard}
                  className="mb-2 w-full rounded bg-slate-700 px-3 py-2 text-white disabled:opacity-60"
                >
                  <option value="AND">AND (todas deben cumplirse)</option>
                  <option value="OR">OR (una debe cumplirse)</option>
                </select>
              </>
            )}

            <button
              type="submit"
              disabled={!editingCard}
              className="w-full rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Agregar Condición
            </button>
          </form>

          <div className="space-y-2">
            {draftConditions.map((condition, index) => (
              <div key={`${condition.id || "new"}-${index}`}>
                {index > 0 && condition.logicOperator && (
                  <div className="mb-1 pl-3 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    {condition.logicOperator}
                  </div>
                )}
                <div className="flex items-center justify-between rounded bg-slate-800 p-3">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-100">
                      {getDataTypeLabel(condition.dataType)} · {getOperatorLabel(condition.operator)}
                    </p>
                    <p className="text-slate-400">
                      {condition.key}
                      {condition.value && ` = ${condition.value}`}
                    </p>
                  </div>

                  <TrashButton
                    onClick={() =>
                      requestDelete(
                        condition.id
                          ? { kind: "condition", id: condition.id }
                          : { kind: "condition", index }
                      )
                    }
                    title="Eliminar condición"
                    disabled={!editingCard}
                  />
                </div>
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
                              onChange={(e) =>
                                setNewEffect({
                                  ...newEffect,
                                  type: e.target.value as NewEffectDraft["type"],
                                  key: "",
                                  value: "",
                                  amount: "0",
                                  item: "",
                                })
                              }
                              className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                            >
                              <option value="">Selecciona tipo</option>
                              <option value="modify_stat">Modify Stat</option>
                              <option value="modify_world_state">Modify World State</option>
                              <option value="modify_flag">Modify Flag</option>
                            </select>

                            {newEffect.type && effectKeyOptions.length > 0 ? (
                              <select
                                value={newEffect.key}
                                onChange={(e) => setNewEffect({ ...newEffect, key: e.target.value, amount: "0", item: "" })}
                                className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                              >
                                <option value="">Selecciona {newEffect.type}</option>
                                {effectKeyOptions.map((key) => (
                                  <option key={key} value={key}>
                                    {key}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder={newEffect.type === "modify_flag" ? "Key (puedes crear una nueva)" : "Key"}
                                value={newEffect.key}
                                onChange={(e) => setNewEffect({ ...newEffect, key: e.target.value })}
                                className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                              />
                            )}

                            {newEffect.type === "modify_stat" && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={newEffect.mode}
                                    onChange={(e) =>
                                      setNewEffect({
                                        ...newEffect,
                                        mode: e.target.value as "set" | "increment" | "decrement",
                                      })
                                    }
                                    className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                  >
                                    <option value="set">set</option>
                                    <option value="increment">increment</option>
                                    <option value="decrement">decrement</option>
                                  </select>
                                  <select
                                    value={newEffect.unit}
                                    onChange={(e) =>
                                      setNewEffect({
                                        ...newEffect,
                                        unit: e.target.value as "number" | "percent",
                                      })
                                    }
                                    className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                  >
                                    <option value="number">number</option>
                                    <option value="percent">percent</option>
                                  </select>
                                </div>
                                <input
                                  type="number"
                                  placeholder={newEffect.unit === "percent" ? "Amount %" : "Amount"}
                                  value={newEffect.amount}
                                  onChange={(e) => setNewEffect({ ...newEffect, amount: e.target.value })}
                                  className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                />
                              </>
                            )}

                            {newEffect.type === "modify_world_state" && newEffect.key && (
                              (() => {
                                const wsType = worldStateTypeMap[newEffect.key]
                                if (wsType === "array") {
                                  return (
                                    <>
                                      <select
                                        value={newEffect.worldArrayMode}
                                        onChange={(e) =>
                                          setNewEffect({
                                            ...newEffect,
                                            worldArrayMode: e.target.value as "add" | "remove" | "clear",
                                          })
                                        }
                                        className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                      >
                                        <option value="add">add</option>
                                        <option value="remove">remove</option>
                                        <option value="clear">clear</option>
                                      </select>
                                      {newEffect.worldArrayMode !== "clear" && (
                                        <input
                                          type="text"
                                          placeholder="Item"
                                          value={newEffect.item}
                                          onChange={(e) => setNewEffect({ ...newEffect, item: e.target.value })}
                                          className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                        />
                                      )}
                                    </>
                                  )
                                }

                                return (
                                  <>
                                    <div className="grid grid-cols-2 gap-2">
                                      <select
                                        value={newEffect.mode}
                                        onChange={(e) =>
                                          setNewEffect({
                                            ...newEffect,
                                            mode: e.target.value as "set" | "increment" | "decrement",
                                          })
                                        }
                                        className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                      >
                                        <option value="set">set</option>
                                        <option value="increment">increment</option>
                                        <option value="decrement">decrement</option>
                                      </select>
                                      <select
                                        value={newEffect.unit}
                                        onChange={(e) =>
                                          setNewEffect({
                                            ...newEffect,
                                            unit: e.target.value as "number" | "percent",
                                          })
                                        }
                                        className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                      >
                                        <option value="number">number</option>
                                        <option value="percent">percent</option>
                                      </select>
                                    </div>
                                    <input
                                      type="number"
                                      placeholder={newEffect.unit === "percent" ? "Amount %" : "Amount"}
                                      value={newEffect.amount}
                                      onChange={(e) => setNewEffect({ ...newEffect, amount: e.target.value })}
                                      className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                                    />
                                  </>
                                )
                              })()
                            )}

                            {newEffect.type === "modify_flag" && (
                              <select
                                value={newEffect.flagMode}
                                onChange={(e) =>
                                  setNewEffect({
                                    ...newEffect,
                                    flagMode: e.target.value as "set" | "remove",
                                  })
                                }
                                className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white"
                              >
                                <option value="set">set</option>
                                <option value="remove">remove</option>
                              </select>
                            )}

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
                            onClick={() => setNewEffect(createEmptyNewEffect(optionIndex))}
                            className="mb-2 w-full rounded bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            + Efecto
                          </button>
                        )}

                        <div className="space-y-1">
                          {option.effects.map((effect, effectIndex) => (
                            <div key={`${effect.id || "new-eff"}-${effectIndex}`} className="flex items-center justify-between rounded bg-slate-600 p-2 text-xs">
                              <span>{formatEffectPreview(effect)}</span>
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
              onClick={() => void saveCardOnly()}
              disabled={isSaving}
              className="rounded border border-blue-400/60 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-600/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Guardando..." : "Guardar Carta"}
            </button>
            <button
              type="button"
              onClick={() => void saveAllChanges()}
              disabled={isSaving}
              className="rounded border border-emerald-400/60 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Guardando todo..." : "Guardar Todo"}
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
