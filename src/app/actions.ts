"use server"

import { revalidatePath } from "next/cache"
import * as prismaService from "@/lib/services/prisma"
import type { InteractionCounterConfig, InteractionRule } from "@/lib/domain"

const ALLOWED_CARD_TYPES = ["decision", "narrative", "interactive"] as const
const ALLOWED_CONDITION_TYPES = ["stat_min", "stat_max", "flag", "not_flag", "world_state"] as const
const ALLOWED_EFFECT_TYPES = [
  "modify_stat",
  "set_flag",
  "add_item",
  "remove_item",
  "modify_world_state",
] as const
const ALLOWED_WORLD_VALUE_TYPES = ["number", "string", "boolean"] as const

function requireText(value: string | undefined, fieldName: string) {
  const normalized = (value || "").trim()
  if (!normalized) {
    throw new Error(`${fieldName} es obligatorio`)
  }
  return normalized
}

function normalizeOptionalText(value?: string) {
  return (value || "").trim()
}

function requireInteger(value: number | undefined, fieldName: string, min?: number, max?: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} debe ser un entero`)
  }

  if (typeof min === "number" && (value as number) < min) {
    throw new Error(`${fieldName} debe ser mayor o igual a ${min}`)
  }

  if (typeof max === "number" && (value as number) > max) {
    throw new Error(`${fieldName} debe ser menor o igual a ${max}`)
  }

  return value as number
}

function validateCardType(type: string | undefined) {
  const normalized = requireText(type, "Tipo de carta")
  if (!ALLOWED_CARD_TYPES.includes(normalized as (typeof ALLOWED_CARD_TYPES)[number])) {
    throw new Error("Tipo de carta invalido")
  }

  if (normalized === "interactive") {
    throw new Error("El tipo interactive aun no esta habilitado")
  }

  return normalized
}

function validateConditionInput(input: { type?: string; key?: string; value?: string }) {
  const type = requireText(input.type, "Tipo de condicion")
  if (!ALLOWED_CONDITION_TYPES.includes(type as (typeof ALLOWED_CONDITION_TYPES)[number])) {
    throw new Error("Tipo de condicion invalido")
  }

  const key = requireText(input.key, "Key de condicion")

  if (type === "stat_min" || type === "stat_max") {
    const rawValue = requireText(input.value, "Valor de condicion")
    const numericValue = Number(rawValue)
    if (!Number.isFinite(numericValue)) {
      throw new Error("Valor de condicion debe ser numerico para stat_min/stat_max")
    }
    return { type, key, value: String(numericValue) }
  }

  if (type === "world_state") {
    const value = requireText(input.value, "Valor de condicion world_state")
    return { type, key, value }
  }

  return { type, key, value: "true" }
}

function validateEffectInput(input: { type?: string; key?: string; value?: string }) {
  const type = requireText(input.type, "Tipo de efecto")
  if (!ALLOWED_EFFECT_TYPES.includes(type as (typeof ALLOWED_EFFECT_TYPES)[number])) {
    throw new Error("Tipo de efecto invalido")
  }

  const key = requireText(input.key, "Key de efecto")
  const value = requireText(input.value, "Valor de efecto")

  if (type === "modify_world_state") {
    const amount = Number(value)
    if (!Number.isFinite(amount)) {
      throw new Error("modify_world_state requiere valor numerico")
    }
    return { type, key, value: String(amount) }
  }

  return { type, key, value }
}

function validateWorldStateInput(input: { key?: string; valueType?: string; value?: string }) {
  const key = requireText(input.key, "Key de world state")
  const valueType = requireText(input.valueType, "Tipo de valor")

  if (!ALLOWED_WORLD_VALUE_TYPES.includes(valueType as (typeof ALLOWED_WORLD_VALUE_TYPES)[number])) {
    throw new Error("Tipo de valor invalido para world state")
  }

  const rawValue = requireText(input.value, "Valor de world state")

  if (valueType === "number") {
    const n = Number(rawValue)
    if (!Number.isFinite(n)) {
      throw new Error("Valor de world state debe ser numerico")
    }
    return { key, valueType, value: String(n) }
  }

  if (valueType === "boolean") {
    if (rawValue !== "true" && rawValue !== "false") {
      throw new Error("Valor booleano debe ser true o false")
    }
    return { key, valueType, value: rawValue }
  }

  return { key, valueType, value: rawValue }
}

// ============================================================================
// GAMES
// ============================================================================

export async function fetchGames() {
  return prismaService.games.getAllGames()
}

export async function fetchGameById(id: string) {
  return prismaService.games.getGameById(id)
}

export async function createGame(game: { name: string; description?: string }) {
  const payload = {
    name: requireText(game.name, "Nombre del juego"),
    description: normalizeOptionalText(game.description),
  }

  const result = await prismaService.games.createGame(payload)
  revalidatePath("/editor")
  return result
}

export async function updateGame(
  id: string,
  updates: { name?: string; description?: string }
) {
  const normalizedUpdates: { name?: string; description?: string } = {}

  if (typeof updates.name === "string") {
    normalizedUpdates.name = requireText(updates.name, "Nombre del juego")
  }

  if (typeof updates.description === "string") {
    normalizedUpdates.description = normalizeOptionalText(updates.description)
  }

  const result = await prismaService.games.updateGame(id, normalizedUpdates)
  revalidatePath("/editor")
  revalidatePath(`/editor/${id}`)
  return result
}

export async function deleteGame(id: string) {
  const result = await prismaService.games.deleteGame(id)
  revalidatePath("/editor")
  return result
}

// ============================================================================
// DECKS
// ============================================================================

export async function fetchDecks() {
  return prismaService.decks.getAllDecks()
}

export async function fetchDecksByGameId(gameId: string) {
  return prismaService.decks.getDecksByGameId(gameId)
}

export async function fetchDeckById(id: string) {
  return prismaService.decks.getDeckById(id)
}

export async function createDeck(data: {
  gameId: string
  name: string
  type: string
  weight: number
  description?: string
}) {
  const payload = {
    gameId: data.gameId,
    name: requireText(data.name, "Nombre del deck"),
    type: requireText(data.type, "Tipo del deck"),
    weight: requireInteger(data.weight, "Peso del deck", 1, 1000),
    description: normalizeOptionalText(data.description),
  }

  const result = await prismaService.decks.createDeck(payload)
  revalidatePath(`/editor/${data.gameId}`)
  return result
}

export async function updateDeck(
  id: string,
  gameId: string,
  updates: { name?: string; type?: string; weight?: number; description?: string; repeatable?: boolean }
) {
  const normalizedUpdates: { name?: string; type?: string; weight?: number; description?: string; repeatable?: boolean } = {}

  if (typeof updates.name === "string") {
    normalizedUpdates.name = requireText(updates.name, "Nombre del deck")
  }

  if (typeof updates.type === "string") {
    normalizedUpdates.type = requireText(updates.type, "Tipo del deck")
  }

  if (typeof updates.weight !== "undefined") {
    normalizedUpdates.weight = requireInteger(updates.weight, "Peso del deck", 1, 1000)
  }

  if (typeof updates.description === "string") {
    normalizedUpdates.description = normalizeOptionalText(updates.description)
  }

  if (typeof updates.repeatable === "boolean") {
    normalizedUpdates.repeatable = updates.repeatable
  }

  const result = await prismaService.decks.updateDeck(id, normalizedUpdates)
  revalidatePath(`/editor/${gameId}`)
  revalidatePath(`/editor/${gameId}/decks/${id}`)
  return result
}

export async function deleteDeck(id: string, gameId: string) {
  const result = await prismaService.decks.deleteDeck(id)
  revalidatePath(`/editor/${gameId}`)
  return result
}

// ============================================================================
// CARDS
// ============================================================================

export async function fetchCardsByDeckId(deckId: string) {
  return prismaService.cards.getCardsByDeckId(deckId)
}

export async function fetchCardById(id: string) {
  return prismaService.cards.getCardById(id)
}

export async function createCard(data: {
  deckId: string
  title: string
  type: string
  description?: string
  priority?: number
  tags?: string[]
}) {
  const payload = {
    deckId: data.deckId,
    title: requireText(data.title, "Titulo de carta"),
    type: validateCardType(data.type),
    description: normalizeOptionalText(data.description),
    priority:
      typeof data.priority === "undefined"
        ? 0
        : requireInteger(data.priority, "Prioridad", -999, 999),
    tags: (data.tags || []).map((t) => t.trim()).filter(Boolean),
  }

  const result = await prismaService.cards.createCard(payload)
  revalidatePath(`/editor`)
  return result
}

export async function updateCard(
  id: string,
  updates: {
    title?: string
    type?: string
    description?: string
    priority?: number
    tags?: string[]
  }
) {
  const normalizedUpdates: {
    title?: string
    type?: string
    description?: string
    priority?: number
    tags?: string[]
  } = {}

  if (typeof updates.title === "string") {
    normalizedUpdates.title = requireText(updates.title, "Titulo de carta")
  }

  if (typeof updates.type === "string") {
    normalizedUpdates.type = validateCardType(updates.type)
  }

  if (typeof updates.description === "string") {
    normalizedUpdates.description = normalizeOptionalText(updates.description)
  }

  if (typeof updates.priority !== "undefined") {
    normalizedUpdates.priority = requireInteger(updates.priority, "Prioridad", -999, 999)
  }

  if (Array.isArray(updates.tags)) {
    normalizedUpdates.tags = updates.tags.map((t) => t.trim()).filter(Boolean)
  }

  const result = await prismaService.cards.updateCard(id, normalizedUpdates)
  revalidatePath(`/editor`)
  return result
}

export async function reorderCardsByDeck(
  deckId: string,
  orderedCardIds: string[]
) {
  if (!Array.isArray(orderedCardIds) || orderedCardIds.length === 0) {
    return []
  }

  const uniqueOrderedIds = Array.from(new Set(orderedCardIds.filter(Boolean)))

  const result = await Promise.all(
    uniqueOrderedIds.map((cardId, index) =>
      prismaService.cards.updateCard(cardId, {
        priority: index + 1,
      })
    )
  )

  revalidatePath(`/editor`)
  return result
}

export async function deleteCard(id: string) {
  const result = await prismaService.cards.deleteCard(id)
  revalidatePath(`/editor`)
  return result
}

// ============================================================================
// CONDITIONS
// ============================================================================

export async function fetchConditionsByCardId(cardId: string) {
  return prismaService.conditions.getConditionsByCardId(cardId)
}

export async function createCondition(
  cardId: string,
  data: { type: string; key: string; value?: string }
) {
  const normalized = validateConditionInput(data)
  const payload = { cardId, ...normalized }

  const result = await prismaService.conditions.createCondition({
    ...payload,
  })
  revalidatePath(`/editor`)
  return result
}

export async function updateCondition(
  id: string,
  updates: { type?: string; key?: string; value?: string }
) {
  if (!updates.type || !updates.key) {
    throw new Error("Actualizar condicion requiere type y key")
  }

  const normalized = validateConditionInput(updates)
  const result = await prismaService.conditions.updateCondition(id, normalized)
  revalidatePath(`/editor`)
  return result
}

export async function deleteCondition(id: string) {
  const result = await prismaService.conditions.deleteCondition(id)
  revalidatePath(`/editor`)
  return result
}

// ============================================================================
// OPTIONS
// ============================================================================

export async function fetchOptionsByCardId(cardId: string) {
  return prismaService.options.getOptionsByCardId(cardId)
}

export async function createOption(data: {
  cardId: string
  text: string
  order?: number
  nextCardId?: string
}) {
  const payload = {
    cardId: data.cardId,
    text: requireText(data.text, "Texto de opcion"),
    order:
      typeof data.order === "undefined"
        ? 1
        : requireInteger(data.order, "Orden de opcion", 1, 999),
    nextCardId: normalizeOptionalText(data.nextCardId) || undefined,
  }

  const result = await prismaService.options.createOption(payload)
  revalidatePath(`/editor`)
  return result
}

export async function updateOption(
  id: string,
  updates: { text?: string; order?: number; nextCardId?: string | null }
) {
  const result = await prismaService.options.updateOption(id, updates)
  revalidatePath(`/editor`)
  return result
}

export async function deleteOption(id: string) {
  const result = await prismaService.options.deleteOption(id)
  revalidatePath(`/editor`)
  return result
}

// ============================================================================
// EFFECTS
// ============================================================================

export async function fetchEffectsByOptionId(optionId: string) {
  return prismaService.effects.getEffectsByOptionId(optionId)
}

export async function fetchFlagKeysByGameId(gameId: string) {
  const rows = await prismaService.effects.getFlagKeysByGameId(gameId)
  return rows.map((row) => row.key)
}

export async function createEffect(
  optionId: string,
  data: { type: string; key: string; value: string }
) {
  const normalized = validateEffectInput(data)
  const payload = {
    optionId,
    ...normalized,
  }

  const result = await prismaService.effects.createEffect({
    ...payload,
  })
  revalidatePath(`/editor`)
  return result
}

export async function updateEffect(
  id: string,
  updates: { type?: string; key?: string; value?: string }
) {
  const result = await prismaService.effects.updateEffect(id, updates)
  revalidatePath(`/editor`)
  return result
}

export async function deleteEffect(id: string) {
  const result = await prismaService.effects.deleteEffect(id)
  revalidatePath(`/editor`)
  return result
}

// ============================================================================
// STATS
// ============================================================================

export async function fetchAllStats() {
  return []
}

export async function fetchStatsByGameId(gameId: string) {
  return prismaService.stats.getStatsByGameId(gameId)
}

export async function fetchStatByKey(gameId: string, key: string) {
  return prismaService.stats.getStatByKey(gameId, key)
}

export async function createStat(
  gameId: string,
  data: { key: string; value?: number; min?: number; max?: number }
) {
  const min = typeof data.min === "undefined" ? 0 : requireInteger(data.min, "Minimo")
  const max = typeof data.max === "undefined" ? 100 : requireInteger(data.max, "Maximo")
  const value = typeof data.value === "undefined" ? 0 : requireInteger(data.value, "Valor")

  if (min > max) {
    throw new Error("Minimo no puede ser mayor que maximo")
  }

  if (value < min || value > max) {
    throw new Error("Valor debe estar dentro del rango minimo-maximo")
  }

  const result = await prismaService.stats.createStat({
    gameId,
    key: requireText(data.key, "Key de stat"),
    value,
    min,
    max,
  })
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function updateStat(
  id: string,
  gameId: string,
  updates: { value?: number; min?: number; max?: number }
) {
  const normalizedUpdates: { value?: number; min?: number; max?: number } = {}

  if (typeof updates.min !== "undefined") {
    normalizedUpdates.min = requireInteger(updates.min, "Minimo")
  }

  if (typeof updates.max !== "undefined") {
    normalizedUpdates.max = requireInteger(updates.max, "Maximo")
  }

  if (typeof updates.value !== "undefined") {
    normalizedUpdates.value = requireInteger(updates.value, "Valor")
  }

  const nextMin = typeof normalizedUpdates.min === "number" ? normalizedUpdates.min : undefined
  const nextMax = typeof normalizedUpdates.max === "number" ? normalizedUpdates.max : undefined
  const nextValue = typeof normalizedUpdates.value === "number" ? normalizedUpdates.value : undefined

  if (typeof nextMin === "number" && typeof nextMax === "number" && nextMin > nextMax) {
    throw new Error("Minimo no puede ser mayor que maximo")
  }

  if (
    typeof nextValue === "number" &&
    typeof nextMin === "number" &&
    nextValue < nextMin
  ) {
    throw new Error("Valor no puede ser menor al minimo")
  }

  if (
    typeof nextValue === "number" &&
    typeof nextMax === "number" &&
    nextValue > nextMax
  ) {
    throw new Error("Valor no puede ser mayor al maximo")
  }

  const result = await prismaService.stats.updateStat(id, normalizedUpdates)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function deleteStat(id: string, gameId: string) {
  const result = await prismaService.stats.deleteStat(id)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

// ============================================================================
// WORLD STATES
// ============================================================================

export async function fetchWorldStatesByGameId(gameId: string) {
  return prismaService.worldStates.getWorldStatesByGameId(gameId)
}

export async function fetchWorldStateByKey(gameId: string, key: string) {
  return prismaService.worldStates.getWorldStateByKey(gameId, key)
}

export async function createWorldState(
  gameId: string,
  data: { key: string; valueType: string; value: string }
) {
  const normalized = validateWorldStateInput(data)
  const result = await prismaService.worldStates.createWorldState({
    gameId,
    ...normalized,
  })
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function updateWorldState(
  id: string,
  gameId: string,
  updates: { key?: string; valueType?: string; value?: string }
) {
  if (!updates.key || !updates.valueType || typeof updates.value === "undefined") {
    throw new Error("Actualizar world state requiere key, valueType y value")
  }

  const normalized = validateWorldStateInput(updates)
  const result = await prismaService.worldStates.updateWorldState(id, normalized)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function deleteWorldState(id: string, gameId: string) {
  const result = await prismaService.worldStates.deleteWorldState(id)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

// ============================================================================
// GAME LOGIC CONFIG
// ============================================================================

export async function fetchGameLogicConfig(gameId: string) {
  const config = await prismaService.gameLogic.getGameLogicByGameId(gameId)

  return {
    counters: (config?.counters as unknown as InteractionCounterConfig[]) || [],
    rules: (config?.rules as unknown as InteractionRule[]) || [],
    weightRules: (config?.weightRules as unknown as import("@/lib/domain").SelectionWeightRule[]) || [],
    constraintRules:
      (config?.constraintRules as unknown as import("@/lib/domain").SelectionConstraintRule[]) || [],
  }
}

export async function saveGameLogicConfig(
  gameId: string,
  data: {
    counters: InteractionCounterConfig[]
    rules: InteractionRule[]
    weightRules?: import("@/lib/domain").SelectionWeightRule[]
    constraintRules?: import("@/lib/domain").SelectionConstraintRule[]
  }
) {
  const counters = Array.isArray(data.counters) ? data.counters : []
  const rules = Array.isArray(data.rules) ? data.rules : []
  const weightRules = Array.isArray(data.weightRules) ? data.weightRules : []
  const constraintRules = Array.isArray(data.constraintRules) ? data.constraintRules : []

  for (const counter of counters) {
    if (!counter?.key?.trim()) {
      throw new Error("Cada contador debe tener key")
    }
  }

  for (const rule of rules) {
    if (!rule?.id || !rule?.when?.counterKey) {
      throw new Error("Cada regla debe tener id y condicion")
    }
  }

  for (const weightRule of weightRules) {
    if (!weightRule?.id || !weightRule?.targetType || !weightRule?.targetKey) {
      throw new Error("Cada regla de peso debe tener id, targetType y targetKey")
    }

    if (!["add", "multiply", "set"].includes(weightRule.operation)) {
      throw new Error("Operacion invalida en regla de peso")
    }

    if (!Number.isFinite(weightRule.value)) {
      throw new Error("Valor invalido en regla de peso")
    }

    if (Array.isArray(weightRule.conditions)) {
      for (const condition of weightRule.conditions) {
        if (!condition?.source || !condition?.key?.trim()) {
          throw new Error("Condicion invalida en regla de peso")
        }

        if (!["counter", "stat", "world", "flag"].includes(condition.source)) {
          throw new Error("Fuente invalida en condicion de regla de peso")
        }

        if (!["eq", "gt", "gte", "lt", "lte"].includes(condition.operator)) {
          throw new Error("Operador invalido en condicion de regla de peso")
        }

        if (typeof condition.value === "undefined" || condition.value === null) {
          throw new Error("Valor faltante en condicion de regla de peso")
        }
      }
    }
  }

  for (const constraintRule of constraintRules) {
    if (!constraintRule?.id || !constraintRule?.targetType || !constraintRule?.targetKey) {
      throw new Error("Cada regla de restriccion debe tener id, targetType y targetKey")
    }

    if (!constraintRule.counterCondition && !Number.isFinite(constraintRule.maxOccurrences)) {
      throw new Error("La regla de restriccion requiere counterCondition o maxOccurrences")
    }

    if (
      Number.isFinite(constraintRule.maxOccurrences) &&
      Number(constraintRule.maxOccurrences) < 0
    ) {
      throw new Error("maxOccurrences invalido en regla de restriccion")
    }

    if (
      constraintRule.counterCondition &&
      !constraintRule.counterCondition.counterKey?.trim()
    ) {
      throw new Error("counterCondition invalida en regla de restriccion")
    }
  }

  const result = await prismaService.gameLogic.upsertGameLogicByGameId({
    gameId,
    counters,
    rules,
    weightRules,
    constraintRules,
  })

  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function bootstrapSelectionLogicSetup(gameId: string) {
  const baseCounters: InteractionCounterConfig[] = [
    {
      key: "interactions.total",
      scope: "global",
      description: "Cantidad total de interacciones resueltas",
    },
    {
      key: "interactions.cycle",
      scope: "global",
      description: "Interacciones acumuladas dentro del ciclo actual",
    },
    {
      key: "cards.shown.total",
      scope: "global",
      description: "Cantidad total de cartas mostradas",
    },
    {
      key: "cards.shown.cycle",
      scope: "global",
      description: "Cantidad de cartas mostradas en el ciclo actual",
    },
    {
      key: "decks.completed.cycle",
      scope: "global",
      description: "Cantidad de flujos de deck finalizados en el ciclo actual",
    },
  ]

  const baseWorldStates = [
    { key: "world.cycle", valueType: "number", value: "1" },
    { key: "world.day", valueType: "number", value: "1" },
    { key: "world.phase", valueType: "string", value: "day" },
    { key: "world.context", valueType: "string", value: "default" },
  ] as const

  const [config, worldStates] = await Promise.all([
    prismaService.gameLogic.getGameLogicByGameId(gameId),
    prismaService.worldStates.getWorldStatesByGameId(gameId),
  ])

  const existingCounters = ((config?.counters as unknown as InteractionCounterConfig[]) || []).filter(
    (counter) => counter?.key?.trim()
  )

  const counterByKey = new Map(existingCounters.map((counter) => [counter.key, counter]))

  for (const counter of baseCounters) {
    if (!counterByKey.has(counter.key)) {
      counterByKey.set(counter.key, counter)
    }
  }

  const mergedCounters = Array.from(counterByKey.values())
  const existingRules = (config?.rules as unknown as InteractionRule[]) || []
  const existingWeightRules = (config?.weightRules as unknown as import("@/lib/domain").SelectionWeightRule[]) || []
  const existingConstraintRules =
    (config?.constraintRules as unknown as import("@/lib/domain").SelectionConstraintRule[]) || []

  await prismaService.gameLogic.upsertGameLogicByGameId({
    gameId,
    counters: mergedCounters,
    rules: existingRules,
    weightRules: existingWeightRules,
    constraintRules: existingConstraintRules,
  })

  const existingWorldStateKeys = new Set(worldStates.map((ws) => ws.key))
  let createdWorldStates = 0

  for (const worldState of baseWorldStates) {
    if (!existingWorldStateKeys.has(worldState.key)) {
      await prismaService.worldStates.createWorldState({
        gameId,
        key: worldState.key,
        valueType: worldState.valueType,
        value: worldState.value,
      })
      createdWorldStates += 1
    }
  }

  revalidatePath(`/editor/${gameId}/logic`)
  revalidatePath(`/editor/${gameId}/stats`)

  return {
    createdWorldStates,
    countersTotal: mergedCounters.length,
  }
}