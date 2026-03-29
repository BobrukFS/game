"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import * as prismaService from "@/lib/services/prisma"
import type { InteractionCounterConfig, InteractionRule, Game, Flag } from "@/lib/domain"

const ALLOWED_CARD_TYPES = ["decision", "narrative", "interactive"] as const
const ALLOWED_CONDITION_DATA_TYPES = ["stat", "flag", "world_state"] as const
const ALLOWED_CONDITION_OPERATORS = ["equal", "not_equal", "min", "max"] as const
const ALLOWED_EFFECT_TYPES = [
  "modify_stat",
  "modify_flag",
  "modify_world_state",
  // Legacy compatibility
  "set_flag",
  "remove_flag",
  "set_world_state",
] as const
const ALLOWED_WORLD_VALUE_TYPES = ["number", "string", "boolean", "array", "enum"] as const

const CACHE_REVALIDATE_SECONDS = 30

const getCachedGames = unstable_cache(
  async () => prismaService.games.getAllGames(),
  ["games:list"],
  { tags: ["games"], revalidate: CACHE_REVALIDATE_SECONDS }
)

function getCachedGameById(id: string) {
  return unstable_cache(
    async () => prismaService.games.getGameById(id),
    ["games:by-id", id],
    { tags: ["games", `game:${id}`], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

function getCachedDecksByGameId(gameId: string) {
  return unstable_cache(
    async () => prismaService.decks.getDecksByGameId(gameId),
    ["decks:by-game", gameId],
    { tags: ["decks", `decks:${gameId}`], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

function getCachedStatsByGameId(gameId: string) {
  return unstable_cache(
    async () => prismaService.stats.getStatsByGameId(gameId),
    ["stats:by-game", gameId],
    { tags: ["stats", `stats:${gameId}`], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

function getCachedWorldStatesByGameId(gameId: string) {
  return unstable_cache(
    async () => prismaService.worldStates.getWorldStatesByGameId(gameId),
    ["world:by-game", gameId],
    { tags: ["worldStates", `worldStates:${gameId}`], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

function getCachedGameLogicByGameId(gameId: string) {
  return unstable_cache(
    async () => prismaService.gameLogic.getGameLogicByGameId(gameId),
    ["logic:config", gameId],
    { tags: ["logic", `logic:${gameId}`], revalidate: CACHE_REVALIDATE_SECONDS }
  )()
}

function getCachedLogicEditorBootstrapByGameId(gameId: string) {
  return unstable_cache(
    async () => prismaService.gameLogic.getLogicEditorBootstrapByGameId(gameId),
    ["logic:bootstrap", gameId],
    {
      tags: [
        "logic",
        `logic:${gameId}`,
        `stats:${gameId}`,
        `worldStates:${gameId}`,
        `decks:${gameId}`,
      ],
      revalidate: CACHE_REVALIDATE_SECONDS,
    }
  )()
}

function requireText(value: string | undefined, fieldName: string) {
  const normalized = (value || "").trim()
  if (!normalized) {
    throw new Error(`${fieldName} es obligatorio`)
  }
  return normalized
}

function normalizeDateToIso(value: unknown): string | undefined {
  if (!value) return undefined

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string") {
    return value
  }

  return undefined
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

function validateConditionInput(input: { dataType?: string; operator?: string; key?: string; value?: string }) {
  const dataType = requireText(input.dataType, "Tipo de dato de condicion")
  if (!ALLOWED_CONDITION_DATA_TYPES.includes(dataType as (typeof ALLOWED_CONDITION_DATA_TYPES)[number])) {
    throw new Error("Tipo de dato de condicion invalido")
  }

  const operator = requireText(input.operator, "Operador de condicion")
  if (!ALLOWED_CONDITION_OPERATORS.includes(operator as (typeof ALLOWED_CONDITION_OPERATORS)[number])) {
    throw new Error("Operador de condicion invalido")
  }

  const key = requireText(input.key, "Key de condicion")

  // Validar combinacion de dataType y operator
  const validOperators: Record<string, string[]> = {
    stat: ["min", "max", "equal"],
    flag: ["equal", "not_equal"],
    world_state: ["equal", "not_equal", "min", "max"],
  }

  if (!validOperators[dataType]?.includes(operator)) {
    throw new Error(`Operador ${operator} no es valido para tipo de dato ${dataType}`)
  }

  // Para stat, require numeric value
  if (dataType === "stat") {
    const rawValue = requireText(input.value, "Valor de condicion")
    const numericValue = Number(rawValue)
    if (!Number.isFinite(numericValue)) {
      throw new Error("Valor de condicion debe ser numerico para stat")
    }
    return { dataType, operator, key, value: String(numericValue) }
  }

  // Para world_state, require value
  if (dataType === "world_state") {
    const value = requireText(input.value, "Valor de condicion world_state")
    return { dataType, operator, key, value }
  }

  // Para flag, value es opcional (siempre es true)
  return { dataType, operator, key, value: "" }
}

function validateDeckConditionInput(input: { dataType?: string; operator?: string; key?: string; logicOperator?: string; order?: number }) {
  const dataType = requireText(input.dataType, "Tipo de dato de condicion de deck")
  if (dataType !== "flag") {
    throw new Error("Las condiciones de deck solo permiten flags")
  }

  const operator = requireText(input.operator, "Operador de condicion de deck")
  if (operator !== "equal" && operator !== "not_equal") {
    throw new Error("Las condiciones de deck solo permiten operadores equal / not_equal")
  }

  const key = requireText(input.key, "Key de condicion de deck")
  const logicOperator = input.logicOperator === "OR" ? "OR" : "AND"
  const order = typeof input.order === "number" ? requireInteger(input.order, "Orden", 1, 999) : 1

  return {
    dataType,
    operator,
    key,
    logicOperator,
    order,
  }
}

function validateEffectInput(input: { type?: string; key?: string; value?: string }) {
  const type = requireText(input.type, "Tipo de efecto")
  if (!ALLOWED_EFFECT_TYPES.includes(type as (typeof ALLOWED_EFFECT_TYPES)[number])) {
    throw new Error("Tipo de efecto invalido")
  }

  const key = requireText(input.key, "Key de efecto")
  const value = requireText(input.value, "Valor de efecto")

  if (type === "modify_flag") {
    try {
      const payload = JSON.parse(value) as { mode?: string }
      if (payload.mode !== "set" && payload.mode !== "remove") {
        throw new Error("modify_flag requiere mode set/remove")
      }
    } catch {
      throw new Error("modify_flag requiere payload JSON valido")
    }
    return { type, key, value }
  }

  if (type === "modify_stat") {
    try {
      const payload = JSON.parse(value) as { mode?: string; unit?: string; amount?: number }
      if (!["set", "increment", "decrement"].includes(String(payload.mode))) {
        throw new Error("modify_stat requiere mode set/increment/decrement")
      }
      if (!["number", "percent"].includes(String(payload.unit))) {
        throw new Error("modify_stat requiere unit number/percent")
      }
      if (!Number.isFinite(Number(payload.amount))) {
        throw new Error("modify_stat requiere amount numerico")
      }
    } catch {
      throw new Error("modify_stat requiere payload JSON valido")
    }
    return { type, key, value }
  }

  if (type === "modify_world_state") {
    try {
      const payload = JSON.parse(value) as {
        targetType?: string
        mode?: string
        unit?: string
        amount?: number
        item?: string
      }

      if (payload.targetType === "number") {
        if (!["set", "increment", "decrement"].includes(String(payload.mode))) {
          throw new Error("modify_world_state numerico requiere mode set/increment/decrement")
        }
        if (!["number", "percent"].includes(String(payload.unit))) {
          throw new Error("modify_world_state numerico requiere unit number/percent")
        }
        if (!Number.isFinite(Number(payload.amount))) {
          throw new Error("modify_world_state numerico requiere amount numerico")
        }
      } else if (payload.targetType === "array") {
        if (!["add", "remove", "clear"].includes(String(payload.mode))) {
          throw new Error("modify_world_state array requiere mode add/remove/clear")
        }
        if ((payload.mode === "add" || payload.mode === "remove") && !String(payload.item || "").trim()) {
          throw new Error("modify_world_state array add/remove requiere item")
        }
      } else {
        throw new Error("modify_world_state requiere targetType number o array")
      }
    } catch {
      throw new Error("modify_world_state requiere payload JSON valido")
    }
    return { type, key, value }
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

  if (valueType === "array") {
    try {
      const parsed = JSON.parse(rawValue)
      if (!Array.isArray(parsed)) {
        throw new Error("Valor array debe ser un JSON array")
      }
    } catch {
      throw new Error("Valor array debe ser JSON valido")
    }
    return { key, valueType, value: rawValue }
  }

  if (valueType === "enum") {
    try {
      const parsed = JSON.parse(rawValue) as { current?: unknown; options?: unknown }
      const options = Array.isArray(parsed?.options)
        ? parsed.options.map((item) => String(item).trim()).filter(Boolean)
        : []

      if (options.length === 0) {
        throw new Error("World state enum requiere al menos una opcion")
      }

      const current = String(parsed?.current ?? "").trim()
      if (!current || !options.includes(current)) {
        throw new Error("World state enum requiere current valido dentro de options")
      }

      return {
        key,
        valueType,
        value: JSON.stringify({ current, options }),
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Valor enum debe ser JSON valido")
    }
  }

  return { key, valueType, value: rawValue }
}

async function assertFlagExistsInGame(gameId: string, key: string) {
  const existing = await prismaService.flags.getFlagByKey(gameId, key)
  if (!existing) {
    throw new Error("La condicion de tipo flag debe usar un flag existente en Variables")
  }
}

// ============================================================================
// GAMES
// ============================================================================

export async function fetchGames(): Promise<Game[]> {
  const games = await getCachedGames()
  return games.map(game => ({
    ...game,
    createdAt: normalizeDateToIso(game.createdAt),
    updatedAt: normalizeDateToIso(game.updatedAt),
  })) as Game[]
}

export async function fetchGameById(id: string): Promise<Game | null> {
  const game = await getCachedGameById(id)
  if (!game) return null
  return {
    ...game,
    createdAt: normalizeDateToIso(game.createdAt),
    updatedAt: normalizeDateToIso(game.updatedAt),
  } as Game
}

export async function createGame(game: { name: string; description?: string }) {
  const payload = {
    name: requireText(game.name, "Nombre del juego"),
    description: normalizeOptionalText(game.description),
  }

  const result = await prismaService.games.createGame(payload)
  revalidateTag("games")
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
  revalidateTag("games")
  revalidateTag(`game:${id}`)
  revalidatePath("/editor")
  revalidatePath(`/editor/${id}`)
  return result
}

export async function deleteGame(id: string) {
  const result = await prismaService.games.deleteGame(id)
  revalidateTag("games")
  revalidateTag(`game:${id}`)
  revalidateTag(`decks:${id}`)
  revalidateTag(`stats:${id}`)
  revalidateTag(`worldStates:${id}`)
  revalidateTag(`logic:${id}`)
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
  return getCachedDecksByGameId(gameId)
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
  revalidateTag("decks")
  revalidateTag(`decks:${data.gameId}`)
  revalidateTag(`logic:${data.gameId}`)
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
  revalidateTag("decks")
  revalidateTag(`decks:${gameId}`)
  revalidateTag(`logic:${gameId}`)
  revalidatePath(`/editor/${gameId}`)
  revalidatePath(`/editor/${gameId}/decks/${id}`)
  return result
}

export async function deleteDeck(id: string, gameId: string) {
  const result = await prismaService.decks.deleteDeck(id)
  revalidateTag("decks")
  revalidateTag(`decks:${gameId}`)
  revalidateTag(`logic:${gameId}`)
  revalidatePath(`/editor/${gameId}`)
  return result
}

export async function fetchDeckConditionsByDeckId(deckId: string) {
  return prismaService.deckConditions.getDeckConditionsByDeckId(deckId)
}

export async function createDeckCondition(
  deckId: string,
  data: { dataType: string; operator: string; key: string; logicOperator?: string; order?: number }
) {
  const normalized = validateDeckConditionInput(data)

  const deck = await prismaService.decks.getDeckById(deckId)
  if (!deck) {
    throw new Error("Deck no encontrado")
  }

  await assertFlagExistsInGame(deck.gameId, normalized.key)

  const result = await prismaService.deckConditions.createDeckCondition({
    deckId,
    ...normalized,
  })

  revalidatePath(`/editor/${deck.gameId}/decks/${deckId}`)
  revalidatePath(`/editor/${deck.gameId}/decks/${deckId}/settings`)
  return result
}

export async function updateDeckCondition(
  id: string,
  deckId: string,
  data: { dataType?: string; operator?: string; key?: string; logicOperator?: string; order?: number }
) {
  const normalized = validateDeckConditionInput(data)

  const deck = await prismaService.decks.getDeckById(deckId)
  if (!deck) {
    throw new Error("Deck no encontrado")
  }

  await assertFlagExistsInGame(deck.gameId, normalized.key)

  const result = await prismaService.deckConditions.updateDeckCondition(id, normalized)

  revalidatePath(`/editor/${deck.gameId}/decks/${deckId}`)
  revalidatePath(`/editor/${deck.gameId}/decks/${deckId}/settings`)
  return result
}

export async function deleteDeckCondition(id: string, deckId: string) {
  const deck = await prismaService.decks.getDeckById(deckId)
  if (!deck) {
    throw new Error("Deck no encontrado")
  }

  const result = await prismaService.deckConditions.deleteDeckCondition(id)
  revalidatePath(`/editor/${deck.gameId}/decks/${deckId}`)
  revalidatePath(`/editor/${deck.gameId}/decks/${deckId}/settings`)
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
  priority?: number | null
  tags?: string[]
}) {
  const payload = {
    deckId: data.deckId,
    title: requireText(data.title, "Titulo de carta"),
    type: validateCardType(data.type),
    description: normalizeOptionalText(data.description),
    priority:
      typeof data.priority === "undefined" || data.priority === null
        ? null
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
    priority?: number | null
    tags?: string[]
  }
) {
  const normalizedUpdates: {
    title?: string
    type?: string
    description?: string
    priority?: number | null
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
    normalizedUpdates.priority =
      updates.priority === null
        ? null
        : requireInteger(updates.priority, "Prioridad", -999, 999)
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
  data: { dataType: string; operator: string; key: string; value?: string; logicOperator?: string; order?: number }
) {
  const normalized = validateConditionInput(data)

  if (normalized.dataType === "flag") {
    const card = await prismaService.cards.getCardById(cardId)
    if (!card) {
      throw new Error("Carta no encontrada")
    }
    const deck = await prismaService.decks.getDeckById(card.deckId)
    if (!deck) {
      throw new Error("Deck no encontrado")
    }
    await assertFlagExistsInGame(deck.gameId, normalized.key)
  }

  const payload = {
    cardId,
    ...normalized,
    logicOperator: data.logicOperator === "OR" ? "OR" : "AND",
    order: data.order || 1,
  }

  const result = await prismaService.conditions.createCondition({
    ...payload,
  })
  revalidatePath(`/editor`)
  return result
}

export async function updateCondition(
  id: string,
  updates: { dataType?: string; operator?: string; key?: string; value?: string; logicOperator?: string; order?: number }
) {
  if (!updates.dataType || !updates.operator || !updates.key) {
    throw new Error("Actualizar condicion requiere dataType, operator y key")
  }

  const normalized = validateConditionInput(updates)

  if (normalized.dataType === "flag") {
    const context = await prismaService.conditions.getConditionContextById(id)
    if (!context) {
      throw new Error("Condicion no encontrada")
    }
    await assertFlagExistsInGame(context.card.deck.gameId, normalized.key)
  }

  const payload = {
    ...normalized,
    logicOperator: updates.logicOperator === "OR" ? "OR" : "AND",
    order: updates.order || 1,
  }
  
  const result = await prismaService.conditions.updateCondition(id, payload)
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
  const rows = await prismaService.flags.getFlagsByGameId(gameId)
  return rows.map((row: { key: string }) => row.key)
}

export async function createEffect(
  optionId: string,
  data: { type: string; key: string; value: string }
) {
  const normalized = validateEffectInput(data)

  if (normalized.type === "set_flag") {
    const optionContext = await prismaService.effects.getOptionGameContext(optionId)
    if (optionContext) {
      await prismaService.flags.upsertFlagByKey(optionContext.card.deck.gameId, normalized.key)
    }
  }

  if (normalized.type === "modify_flag") {
    const optionContext = await prismaService.effects.getOptionGameContext(optionId)
    if (optionContext) {
      try {
        const payload = JSON.parse(normalized.value) as { mode?: string }
        if (payload.mode === "set") {
          await prismaService.flags.upsertFlagByKey(optionContext.card.deck.gameId, normalized.key)
        }
      } catch {
        // validation already handled in validateEffectInput
      }
    }
  }

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
  const current = await prismaService.effects.getEffectGameContext(id)
  if (!current) {
    throw new Error("Efecto no encontrado")
  }

  const nextType = updates.type || current.type
  const nextKey = (updates.key || current.key || "").trim()

  if (nextType === "set_flag" && nextKey) {
    await prismaService.flags.upsertFlagByKey(current.option.card.deck.gameId, nextKey)
  }

  if (nextType === "modify_flag" && nextKey) {
    try {
      const payload = JSON.parse(updates.value || "") as { mode?: string }
      if (payload.mode === "set") {
        await prismaService.flags.upsertFlagByKey(current.option.card.deck.gameId, nextKey)
      }
    } catch {
      // validation already handled in validateEffectInput when value is provided
    }
  }

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
  return getCachedStatsByGameId(gameId)
}

export async function fetchVariableReferences(
  gameId: string,
  variableType: "stat" | "world_state" | "flag",
  key: string
) {
  const normalizedKey = requireText(key, "Key de variable")
  const references = await prismaService.variableReferences.getVariableReferences(
    gameId,
    variableType,
    normalizedKey
  )

  return {
    cards: references.cards,
    decks: references.decks,
    cardsCount: references.cards.length,
    decksCount: references.decks.length,
  }
}

export async function fetchNarrativeTagIndex(gameId: string) {
  return prismaService.narrativeReferences.getNarrativeTagIndex(gameId)
}

export async function fetchFlagsByGameId(gameId: string): Promise<Flag[]> {
  return prismaService.flags.getFlagsByGameId(gameId)
}

export async function createFlag(gameId: string, data: { key: string }) {
  const result = await prismaService.flags.createFlag({
    gameId,
    key: requireText(data.key, "Key de flag"),
  })
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function updateFlag(id: string, gameId: string, updates: { key?: string }) {
  const normalizedUpdates: { key?: string } = {}
  if (typeof updates.key === "string") {
    normalizedUpdates.key = requireText(updates.key, "Key de flag")
  }

  const result = await prismaService.flags.updateFlag(id, normalizedUpdates)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function deleteFlag(id: string, gameId: string) {
  const result = await prismaService.flags.deleteFlag(id)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
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
  revalidateTag("stats")
  revalidateTag(`stats:${gameId}`)
  revalidateTag(`logic:${gameId}`)
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
  revalidateTag("stats")
  revalidateTag(`stats:${gameId}`)
  revalidateTag(`logic:${gameId}`)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function deleteStat(id: string, gameId: string) {
  const result = await prismaService.stats.deleteStat(id)
  revalidateTag("stats")
  revalidateTag(`stats:${gameId}`)
  revalidateTag(`logic:${gameId}`)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

// ============================================================================
// WORLD STATES
// ============================================================================

export async function fetchWorldStatesByGameId(gameId: string) {
  return getCachedWorldStatesByGameId(gameId)
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
  revalidateTag("worldStates")
  revalidateTag(`worldStates:${gameId}`)
  revalidateTag(`logic:${gameId}`)
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
  revalidateTag("worldStates")
  revalidateTag(`worldStates:${gameId}`)
  revalidateTag(`logic:${gameId}`)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

export async function deleteWorldState(id: string, gameId: string) {
  const result = await prismaService.worldStates.deleteWorldState(id)
  revalidateTag("worldStates")
  revalidateTag(`worldStates:${gameId}`)
  revalidateTag(`logic:${gameId}`)
  revalidatePath(`/editor/${gameId}/stats`)
  return result
}

// ============================================================================
// GAME LOGIC CONFIG
// ============================================================================

export async function fetchGameLogicConfig(gameId: string) {
  const config = await getCachedGameLogicByGameId(gameId)

  return {
    counters: (config?.counters as unknown as InteractionCounterConfig[]) || [],
    rules: (config?.rules as unknown as InteractionRule[]) || [],
    weightRules: (config?.weightRules as unknown as import("@/lib/domain").SelectionWeightRule[]) || [],
    constraintRules:
      (config?.constraintRules as unknown as import("@/lib/domain").SelectionConstraintRule[]) || [],
  }
}

export async function fetchLogicEditorBootstrap(gameId: string) {
  const bootstrap = await getCachedLogicEditorBootstrapByGameId(gameId)

  return {
    counters: (bootstrap.config?.counters as unknown as InteractionCounterConfig[]) || [],
    rules: (bootstrap.config?.rules as unknown as InteractionRule[]) || [],
    weightRules:
      (bootstrap.config?.weightRules as unknown as import("@/lib/domain").SelectionWeightRule[]) || [],
    constraintRules:
      (bootstrap.config?.constraintRules as unknown as import("@/lib/domain").SelectionConstraintRule[]) || [],
    statKeys: bootstrap.statKeys,
    worldStateKeys: bootstrap.worldStateKeys,
    deckWeights: bootstrap.deckWeights,
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

    for (const action of rule.actions || []) {
      if (!action?.type || !action?.key?.trim()) {
        throw new Error("Cada accion de regla debe tener type y key")
      }

      if (action.type === "step_world_state_option") {
        const options = Array.isArray(action.options)
          ? action.options.map((option) => String(option).trim()).filter(Boolean)
          : []

        if (Array.isArray(action.options) && options.length === 0) {
          throw new Error("step_world_state_option con options requiere al menos una opcion valida")
        }

        if (
          typeof action.defaultIndex !== "undefined" &&
          !Number.isFinite(Number(action.defaultIndex))
        ) {
          throw new Error("defaultIndex invalido en step_world_state_option")
        }

        if (
          typeof action.amount !== "undefined" &&
          !Number.isFinite(Number(action.amount))
        ) {
          throw new Error("amount invalido en step_world_state_option")
        }
      }
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

        if (!["counter", "stat", "world", "flag", "deck", "card"].includes(condition.source)) {
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

    if (![
      "deck_type",
      "deck_id",
      "card_type",
      "card_id",
    ].includes(constraintRule.targetType)) {
      throw new Error("targetType invalido en regla de restriccion")
    }

    if (!constraintRule.counterCondition) {
      throw new Error("La regla de restriccion requiere counterCondition")
    }

    if (
      constraintRule.counterCondition &&
      !constraintRule.counterCondition.counterKey?.trim()
    ) {
      throw new Error("counterCondition invalida en regla de restriccion")
    }

    if (Array.isArray(constraintRule.conditions)) {
      for (const condition of constraintRule.conditions) {
        if (!condition?.source || !condition?.key?.trim()) {
          throw new Error("Condicion invalida en regla de restriccion")
        }

        if (![
          "counter",
          "stat",
          "world",
          "flag",
          "deck",
          "card",
        ].includes(condition.source)) {
          throw new Error("Fuente invalida en condicion de regla de restriccion")
        }

        if (!["eq", "gt", "gte", "lt", "lte"].includes(condition.operator)) {
          throw new Error("Operador invalido en condicion de regla de restriccion")
        }

        if (typeof condition.value === "undefined" || condition.value === null) {
          throw new Error("Valor faltante en condicion de regla de restriccion")
        }
      }
    }

    if (constraintRule.scope && !["cycle", "global"].includes(constraintRule.scope)) {
      throw new Error("scope invalido en regla de restriccion")
    }

  }

  const result = await prismaService.gameLogic.upsertGameLogicByGameId({
    gameId,
    counters: counters as any,
    rules: rules as any,
    weightRules: weightRules as any,
    constraintRules: constraintRules as any,
  })

  revalidateTag("logic")
  revalidateTag(`logic:${gameId}`)
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
    {
      key: "world.phase",
      valueType: "enum",
      value: JSON.stringify({ current: "day", options: ["day", "sunset", "night"] }),
    },
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
    counters: mergedCounters as any,
    rules: existingRules as any,
    weightRules: existingWeightRules as any,
    constraintRules: existingConstraintRules as any,
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