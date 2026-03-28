import {
  GameState,
  GameLogicConfig,
  RuleOperator,
  SelectionCondition,
  SelectionConstraintRule,
  SelectionWeightRule,
} from "@/lib/domain"
import { applyGameLogicEvent, applyGameLogicEvents } from "@/lib/engine/ruleEngine"
import {
  PlayRuntimeBundle,
  PlayRuntimeCard,
  PlayRuntimeDeck,
  PlayRuntimeOption,
} from "@/lib/services/prisma/playRuntime"

export interface CardConditionEvaluation {
  type: string
  key: string
  expected: string
  actual: string
  passed: boolean
}

export interface CardDebugEntry {
  cardId: string
  title: string
  valid: boolean
  evaluations: CardConditionEvaluation[]
}

export interface DrawResult {
  state: GameState
  card: PlayRuntimeCard | null
  debug: CardDebugEntry[]
  message?: string
}

export interface OptionApplyResult {
  state: GameState
  message?: string
}

function parseWorldStateValue(valueType: string, value: string): string | number | boolean {
  if (valueType === "number") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }

  if (valueType === "boolean") {
    return value === "true"
  }

  return value
}

function getDeckWeight(deck: PlayRuntimeDeck | undefined): number {
  if (!deck) return 1
  return Number.isFinite(deck.weight) && deck.weight > 0 ? deck.weight : 1
}

function compareCounterCondition(current: number, operator: RuleOperator, expected: number) {
  switch (operator) {
    case "eq":
      return current === expected
    case "gt":
      return current > expected
    case "gte":
      return current >= expected
    case "lt":
      return current < expected
    case "lte":
      return current <= expected
    default:
      return false
  }
}

function compareRuleValue(
  actual: number | string | boolean,
  operator: RuleOperator,
  expected: number | string | boolean
) {
  if (operator === "eq") {
    return String(actual) === String(expected)
  }

  const actualNumber = Number(actual)
  const expectedNumber = Number(expected)
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    return false
  }

  return compareCounterCondition(actualNumber, operator, expectedNumber)
}

function getSelectionConditionActualValue(condition: SelectionCondition, state: GameState) {
  if (condition.source === "counter") {
    return Number(state.interactions?.counters?.[condition.key] || 0)
  }

  if (condition.source === "stat") {
    return Number(state.stats[condition.key] || 0)
  }

  if (condition.source === "world") {
    return resolveWorldValue(state, condition.key)
  }

  return Boolean(state.flags[condition.key])
}

function areSelectionConditionsMatching(conditions: SelectionCondition[] | undefined, state: GameState) {
  if (!conditions || conditions.length === 0) return true

  for (const condition of conditions) {
    const actual = getSelectionConditionActualValue(condition, state)
    if (!compareRuleValue(actual ?? "", condition.operator, condition.value)) {
      return false
    }
  }

  return true
}

function isWeightRuleMatchingDeck(
  rule: SelectionWeightRule,
  state: GameState,
  deck: PlayRuntimeDeck
) {
  if (rule.targetType === "deck_id" && rule.targetKey !== deck.id) {
    return false
  }

  if (rule.targetType === "deck_type" && rule.targetKey !== deck.type) {
    return false
  }

  if (rule.conditions && rule.conditions.length > 0) {
    return areSelectionConditionsMatching(rule.conditions, state)
  }

  if (rule.whenCounter) {
    const currentCounter = Number(state.interactions?.counters?.[rule.whenCounter.counterKey] || 0)
    if (!compareCounterCondition(currentCounter, rule.whenCounter.operator, rule.whenCounter.value)) {
      return false
    }
  }

  const filters = rule.filters
  if (!filters) return true

  if (filters.phase && String(state.world.phase || "") !== filters.phase) {
    return false
  }

  if (filters.context && String(state.world.context || "") !== filters.context) {
    return false
  }

  if (typeof filters.dayMin === "number" && Number(state.world.day || 0) < filters.dayMin) {
    return false
  }

  if (typeof filters.dayMax === "number" && Number(state.world.day || 0) > filters.dayMax) {
    return false
  }

  if (filters.statKey && filters.statOperator && typeof filters.statValue === "number") {
    const statValue = Number(state.stats[filters.statKey] || 0)
    if (!compareCounterCondition(statValue, filters.statOperator, filters.statValue)) {
      return false
    }
  }

  if (filters.flagKey) {
    const expected = typeof filters.flagValue === "boolean" ? filters.flagValue : true
    if (Boolean(state.flags[filters.flagKey]) !== expected) {
      return false
    }
  }

  return true
}

function isConstraintRuleMatchingDeck(
  rule: SelectionConstraintRule,
  state: GameState,
  deck: PlayRuntimeDeck
) {
  if (rule.targetType === "deck_id" && rule.targetKey !== deck.id) {
    return false
  }

  if (rule.targetType === "deck_type" && rule.targetKey !== deck.type) {
    return false
  }

  if (rule.whenCounter) {
    const currentCounter = Number(state.interactions?.counters?.[rule.whenCounter.counterKey] || 0)
    if (!compareCounterCondition(currentCounter, rule.whenCounter.operator, rule.whenCounter.value)) {
      return false
    }
  }

  const filters = rule.filters
  if (!filters) return true

  if (filters.phase && String(state.world.phase || "") !== filters.phase) {
    return false
  }

  if (filters.context && String(state.world.context || "") !== filters.context) {
    return false
  }

  if (typeof filters.dayMin === "number" && Number(state.world.day || 0) < filters.dayMin) {
    return false
  }

  if (typeof filters.dayMax === "number" && Number(state.world.day || 0) > filters.dayMax) {
    return false
  }

  if (filters.statKey && filters.statOperator && typeof filters.statValue === "number") {
    const statValue = Number(state.stats[filters.statKey] || 0)
    if (!compareCounterCondition(statValue, filters.statOperator, filters.statValue)) {
      return false
    }
  }

  if (filters.flagKey) {
    const expected = typeof filters.flagValue === "boolean" ? filters.flagValue : true
    if (Boolean(state.flags[filters.flagKey]) !== expected) {
      return false
    }
  }

  return true
}

function getConstraintScopeKey(rule: SelectionConstraintRule, state: GameState) {
  if (rule.scope === "global") {
    return "global"
  }

  const day = String(state.world.day ?? "")
  return `cycle:${day}`
}

function getConstraintCounterKey(rule: SelectionConstraintRule, state: GameState) {
  return `runtime.selection.${rule.id}.${getConstraintScopeKey(rule, state)}`
}

function isConstraintRuleBlockingByCounter(rule: SelectionConstraintRule, state: GameState) {
  if (!rule.counterCondition) return false

  const currentCounter = Number(
    state.interactions?.counters?.[rule.counterCondition.counterKey] || 0
  )
  return compareCounterCondition(
    currentCounter,
    rule.counterCondition.operator,
    rule.counterCondition.value
  )
}

function isCardAllowedByConstraints(
  card: PlayRuntimeCard,
  bundle: PlayRuntimeBundle,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  const deck = bundle.decks.find((item) => item.id === card.deckId)
  if (!deck) return true

  for (const rule of logicConfig.constraintRules || []) {
    if (!isConstraintRuleMatchingDeck(rule, state, deck)) {
      continue
    }

    if (isConstraintRuleBlockingByCounter(rule, state)) {
      return false
    }

    if (!Number.isFinite(rule.maxOccurrences)) {
      continue
    }

    const counterKey = getConstraintCounterKey(rule, state)
    const currentCount = Number(state.interactions?.counters?.[counterKey] || 0)
    if (currentCount >= Number(rule.maxOccurrences)) {
      return false
    }
  }

  return true
}

function incrementSelectionConstraintCounters(
  state: GameState,
  selectedDeck: PlayRuntimeDeck,
  logicConfig: GameLogicConfig
) {
  const counters = { ...(state.interactions?.counters || {}) }

  for (const rule of logicConfig.constraintRules || []) {
    if (!Number.isFinite(rule.maxOccurrences)) {
      continue
    }

    if (!isConstraintRuleMatchingDeck(rule, state, selectedDeck)) {
      continue
    }

    const key = getConstraintCounterKey(rule, state)
    counters[key] = Number(counters[key] || 0) + 1
  }

  return {
    ...state,
    interactions: {
      ...state.interactions,
      total: Number(counters["interactions.total"] || state.interactions?.total || 0),
      counters,
    },
  }
}

function getEffectiveDeckWeight(
  deck: PlayRuntimeDeck,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  let nextWeight = getDeckWeight(deck)

  for (const rule of logicConfig.weightRules || []) {
    if (!isWeightRuleMatchingDeck(rule, state, deck)) {
      continue
    }

    if (rule.operation === "set") {
      nextWeight = rule.value
      continue
    }

    if (rule.operation === "add") {
      nextWeight += rule.value
      continue
    }

    if (rule.operation === "multiply") {
      nextWeight *= rule.value
    }
  }

  return Number.isFinite(nextWeight) ? Math.max(nextWeight, 0) : 0
}

function compareByPriorityThenId(left: PlayRuntimeCard, right: PlayRuntimeCard) {
  if (left.priority !== right.priority) {
    return left.priority - right.priority
  }

  return left.id.localeCompare(right.id)
}

function resolveWorldValue(state: GameState, key: string) {
  if (key in state.world) return state.world[key]

  if (key === "day") return state.world.day
  if (key === "phase") return state.world.phase

  return undefined
}

function evaluateCardConditions(card: PlayRuntimeCard, state: GameState): CardConditionEvaluation[] {
  return card.conditions.map((condition) => {
    const expected = String(condition.value ?? "")

    if (condition.type === "stat_min") {
      const actualValue = Number(state.stats[condition.key] || 0)
      const threshold = Number(condition.value)
      return {
        type: condition.type,
        key: condition.key,
        expected,
        actual: String(actualValue),
        passed: actualValue >= threshold,
      }
    }

    if (condition.type === "stat_max") {
      const actualValue = Number(state.stats[condition.key] || 0)
      const threshold = Number(condition.value)
      return {
        type: condition.type,
        key: condition.key,
        expected,
        actual: String(actualValue),
        passed: actualValue <= threshold,
      }
    }

    if (condition.type === "flag") {
      const actual = state.flags[condition.key] === true
      return {
        type: condition.type,
        key: condition.key,
        expected: "true",
        actual: String(actual),
        passed: actual,
      }
    }

    if (condition.type === "not_flag") {
      const actual = state.flags[condition.key] === true
      return {
        type: condition.type,
        key: condition.key,
        expected: "false",
        actual: String(actual),
        passed: !actual,
      }
    }

    if (condition.type === "world_state") {
      const actual = resolveWorldValue(state, condition.key)
      return {
        type: condition.type,
        key: condition.key,
        expected,
        actual: String(actual ?? "undefined"),
        passed: String(actual) === String(condition.value),
      }
    }

    if (condition.type === "day_min") {
      const actual = Number(state.world.day || 0)
      const min = Number(condition.value)
      return {
        type: condition.type,
        key: condition.key,
        expected,
        actual: String(actual),
        passed: actual >= min,
      }
    }

    if (condition.type === "day_max") {
      const actual = Number(state.world.day || 0)
      const max = Number(condition.value)
      return {
        type: condition.type,
        key: condition.key,
        expected,
        actual: String(actual),
        passed: actual <= max,
      }
    }

    if (condition.type === "time_phase") {
      const actual = String(state.world.phase || "")
      return {
        type: condition.type,
        key: condition.key,
        expected,
        actual,
        passed: actual === String(condition.value),
      }
    }

    return {
      type: condition.type,
      key: condition.key,
      expected,
      actual: "unsupported",
      passed: false,
    }
  })
}

function pickCardFromValidPool(
  cards: PlayRuntimeCard[],
  decksById: Map<string, PlayRuntimeDeck>,
  state: GameState,
  logicConfig: GameLogicConfig
): PlayRuntimeCard {
  const byDeck = new Map<string, PlayRuntimeCard[]>()

  cards.forEach((card) => {
    byDeck.set(card.deckId, [...(byDeck.get(card.deckId) || []), card])
  })

  const sortedDeckIds = Array.from(byDeck.keys()).sort((leftDeckId, rightDeckId) => {
    const leftDeck = decksById.get(leftDeckId)
    const rightDeck = decksById.get(rightDeckId)
    const leftWeight = leftDeck ? getEffectiveDeckWeight(leftDeck, state, logicConfig) : 0
    const rightWeight = rightDeck ? getEffectiveDeckWeight(rightDeck, state, logicConfig) : 0

    if (leftWeight !== rightWeight) {
      return rightWeight - leftWeight
    }

    return leftDeckId.localeCompare(rightDeckId)
  })

  const selectedDeckId = sortedDeckIds[0]
  const deckCards = [...(byDeck.get(selectedDeckId) || [])]

  deckCards.sort(compareByPriorityThenId)
  if (deckCards.length === 0) {
    // Defensive fallback; valid pool is guaranteed non-empty by caller.
    return cards.slice().sort(compareByPriorityThenId)[0]
  }

  return deckCards[0]
}

function sortByEffectiveWeightThenPriority(
  cards: PlayRuntimeCard[],
  decksById: Map<string, PlayRuntimeDeck>,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  return [...cards].sort((left, right) => {
    const leftDeck = decksById.get(left.deckId)
    const rightDeck = decksById.get(right.deckId)
    const leftWeight = leftDeck ? getEffectiveDeckWeight(leftDeck, state, logicConfig) : 0
    const rightWeight = rightDeck ? getEffectiveDeckWeight(rightDeck, state, logicConfig) : 0

    if (leftWeight !== rightWeight) {
      return rightWeight - leftWeight
    }

    return compareByPriorityThenId(left, right)
  })
}

function normalizeGameLogicConfig(bundle: PlayRuntimeBundle): GameLogicConfig {
  return {
    counters: bundle.logic.counters || [],
    rules: bundle.logic.rules || [],
    weightRules: bundle.logic.weightRules || [],
    constraintRules: bundle.logic.constraintRules || [],
  }
}

export function buildInitialGameState(bundle: PlayRuntimeBundle): GameState {
  const stats = Object.fromEntries(bundle.stats.map((stat) => [stat.key, stat.value]))
  const world = Object.fromEntries(
    bundle.worldStates.map((ws) => [ws.key, parseWorldStateValue(ws.valueType, ws.value)])
  )

  const counters: Record<string, number> = {}
  ;(bundle.logic.counters || []).forEach((counter: any) => {
    counters[counter.key] = 0
  })

  if (!("interactions.total" in counters)) {
    counters["interactions.total"] = 0
  }

  return {
    stats,
    inventory: [],
    flags: {},
    world,
    completedDecks: [],
    interactions: {
      total: counters["interactions.total"] || 0,
      counters,
    },
    history: [],
  }
}

export function drawNextCard(bundle: PlayRuntimeBundle, state: GameState): DrawResult {
  const logicConfig = normalizeGameLogicConfig(bundle)
  const decksById = new Map(bundle.decks.map((deck) => [deck.id, deck]))

  const debugEntries = bundle.cards.map((card) => {
    const evaluations = evaluateCardConditions(card, state)
    return {
      cardId: card.id,
      title: card.title,
      evaluations,
      valid: evaluations.every((evaluation) => evaluation.passed),
    }
  })

  if (state.activeSequence?.currentCardId) {
    const sequenceCard = bundle.cards.find((card) => card.id === state.activeSequence?.currentCardId)
    if (!sequenceCard) {
      const nextState = applyGameLogicEvent(
        { ...state, activeSequence: undefined },
        logicConfig,
        { type: "sequence_paused" }
      )
      return {
        state: nextState,
        card: null,
        debug: debugEntries,
        message: "La secuencia activa apunta a una carta inexistente.",
      }
    }

    const evaluations = evaluateCardConditions(sequenceCard, state)
    const valid = evaluations.every((evaluation) => evaluation.passed)

    if (!valid) {
      const nextState = applyGameLogicEvent(state, logicConfig, {
        type: "sequence_paused",
        cardId: sequenceCard.id,
      })
      return {
        state: nextState,
        card: null,
        debug: debugEntries,
        message: "La secuencia se pauso porque la siguiente carta no cumple condiciones.",
      }
    }

    const nextState = applyGameLogicEvent(state, logicConfig, {
      type: "card_shown",
      cardId: sequenceCard.id,
    })

    const sequenceDeck = decksById.get(sequenceCard.deckId)
    const constrainedState = sequenceDeck
      ? incrementSelectionConstraintCounters(nextState, sequenceDeck, logicConfig)
      : nextState

    return {
      state: constrainedState,
      card: sequenceCard,
      debug: debugEntries,
    }
  }

  const validCards = debugEntries
    .filter((entry) => entry.valid)
    .map((entry) => bundle.cards.find((card) => card.id === entry.cardId))
    .filter((card): card is PlayRuntimeCard => !!card)

  // Filter out cards from completed non-repeatable decks
  const cardsFromRepeatableDecks = validCards.filter((card) => {
    const deck = decksById.get(card.deckId)
    if (!deck || deck.repeatable) return true
    return !state.completedDecks.includes(card.deckId)
  })

  const scoredCards = sortByEffectiveWeightThenPriority(cardsFromRepeatableDecks, decksById, state, logicConfig)

  const constrainedCards = scoredCards.filter((card) =>
    isCardAllowedByConstraints(card, bundle, state, logicConfig)
  )

  if (validCards.length === 0) {
    return {
      state,
      card: null,
      debug: debugEntries,
      message: "No hay cartas validas para el estado actual.",
    }
  }

  if (constrainedCards.length === 0) {
    return {
      state,
      card: null,
      debug: debugEntries,
      message: "No hay cartas disponibles por restricciones de seleccion.",
    }
  }

  const selected = constrainedCards[0] || pickCardFromValidPool(constrainedCards, decksById, state, logicConfig)
  const nextState = applyGameLogicEvent(state, logicConfig, {
    type: "card_shown",
    cardId: selected.id,
  })

  const selectedDeck = decksById.get(selected.deckId)
  const constrainedState = selectedDeck
    ? incrementSelectionConstraintCounters(nextState, selectedDeck, logicConfig)
    : nextState

  return {
    state: constrainedState,
    card: selected,
    debug: debugEntries,
  }
}

function applyOptionEffects(state: GameState, option: PlayRuntimeOption) {
  const nextState: GameState = {
    ...state,
    stats: { ...state.stats },
    world: { ...state.world },
    inventory: [...state.inventory],
    flags: { ...state.flags },
  }

  option.effects.forEach((effect) => {
    if (effect.type === "modify_stat") {
      const current = Number(nextState.stats[effect.key] || 0)
      nextState.stats[effect.key] = current + Number(effect.value || 0)
      return
    }

    if (effect.type === "set_flag") {
      const normalized = effect.value === "true"
      nextState.flags[effect.key] = normalized
      return
    }

    if (effect.type === "add_item") {
      if (!nextState.inventory.includes(effect.key)) {
        nextState.inventory.push(effect.key)
      }
      return
    }

    if (effect.type === "remove_item") {
      nextState.inventory = nextState.inventory.filter((item) => item !== effect.key)
      return
    }

    if (effect.type === "modify_world_state") {
      const current = Number(nextState.world[effect.key] || 0)
      nextState.world[effect.key] = current + Number(effect.value || 0)
    }
  })

  return nextState
}

function collectChangedStatEvents(previous: GameState, next: GameState) {
  const keys = new Set([...Object.keys(previous.stats || {}), ...Object.keys(next.stats || {})])
  const events: { type: "stat_changed"; statKey: string }[] = []

  keys.forEach((key) => {
    if (Number(previous.stats[key] || 0) !== Number(next.stats[key] || 0)) {
      events.push({ type: "stat_changed", statKey: key })
    }
  })

  return events
}

export function applySelectedOption(
  bundle: PlayRuntimeBundle,
  state: GameState,
  cardId: string,
  optionId: string
): OptionApplyResult {
  const card = bundle.cards.find((item) => item.id === cardId)
  if (!card) {
    return { state, message: "No se encontro la carta seleccionada." }
  }

  const option = card.options.find((item) => item.id === optionId)
  if (!option) {
    return { state, message: "No se encontro la opcion seleccionada." }
  }

  const logicConfig = normalizeGameLogicConfig(bundle)
  const afterEffects = applyOptionEffects(state, option)
  const statEvents = collectChangedStatEvents(state, afterEffects)

  const withHistory: GameState = {
    ...afterEffects,
    history: [...afterEffects.history, { cardId, optionId }],
  }

  let nextState = applyGameLogicEvent(withHistory, logicConfig, {
    type: "option_resolved",
    cardId,
    optionId,
  })

  nextState = applyGameLogicEvents(nextState, logicConfig, statEvents)

  if (option.nextCardId) {
    nextState = applyGameLogicEvent(
      {
        ...nextState,
        activeSequence: { currentCardId: option.nextCardId },
      },
      logicConfig,
      {
        type: "sequence_started",
        cardId: option.nextCardId,
        optionId,
      }
    )

    return { state: nextState }
  }

  // Mark the deck as completed
  const completedDecksUpdated = state.completedDecks.includes(card.deckId)
    ? state.completedDecks
    : [...state.completedDecks, card.deckId]

  nextState = applyGameLogicEvent(
    {
      ...nextState,
      activeSequence: undefined,
      completedDecks: completedDecksUpdated,
    },
    logicConfig,
    {
      type: "sequence_completed",
      cardId,
      optionId,
    }
  )

  return { state: nextState }
}
