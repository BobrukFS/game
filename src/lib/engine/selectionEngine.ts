/**
 * Selection Engine - Card selection logic with weights, constraints, and conditions
 * Responsibilities:
 * - Filter valid cards based on conditions
 * - Apply weight multipliers based on game rules
 * - Apply selection constraints (max occurrences, scoped limits)
 * - Select next card using weighted random selection
 * - Handle active sequences (directed card paths)
 */

import {
  GameState,
  GameLogicConfig,
  RuleOperator,
  SelectionCondition,
  SelectionConstraintRule,
  SelectionWeightRule,
} from "@/lib/domain"
import { applyGameLogicEvent } from "./ruleEngine"
import { RuntimeRuleTraceEntry } from "./ruleEngine"
import { evaluateCondition } from "./game/conditionEngine"
import {
  PlayRuntimeBundle,
  PlayRuntimeCard,
  PlayRuntimeDeck,
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

interface SelectionCandidateContext {
  deck?: PlayRuntimeDeck
  card?: PlayRuntimeCard
}

function normalizeCardPriority(priority: number | null | undefined) {
  return typeof priority === "number" && Number.isFinite(priority)
    ? priority
    : Number.POSITIVE_INFINITY
}

export interface DrawResult {
  state: GameState
  card: PlayRuntimeCard | null
  debug: CardDebugEntry[]
  message?: string
  ruleEvents?: RuntimeRuleTraceEntry[]
}

/**
 * Normalize logic config with safe defaults
 */
function normalizeGameLogicConfig(bundle: PlayRuntimeBundle): GameLogicConfig {
  return {
    counters: bundle.logic?.counters || [],
    rules: bundle.logic?.rules || [],
    constraintRules: bundle.logic?.constraintRules || [],
    weightRules: bundle.logic?.weightRules || [],
  }
}

/**
 * Compare two values using a rule operator
 */
function compareRuleValue(
  actual: number | string | boolean | string[],
  operator: RuleOperator,
  expected: number | string | boolean
) {
  const normalizedActual = Array.isArray(actual) ? JSON.stringify(actual) : actual

  if (operator === "eq") {
    return String(normalizedActual) === String(expected)
  }

  const actualNumber = Number(normalizedActual)
  const expectedNumber = Number(expected)
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    return false
  }

  return compareCounterCondition(actualNumber, operator, expectedNumber)
}

function isRuleTargetMatching(
  targetType: SelectionWeightRule["targetType"],
  targetKey: string,
  context: SelectionCandidateContext
) {
  if (targetKey === "*") {
    return true
  }

  if (targetType === "deck_id") {
    return context.deck?.id === targetKey
  }

  if (targetType === "deck_type") {
    return context.deck?.type === targetKey
  }

  if (targetType === "card_id") {
    return context.card?.id === targetKey
  }

  if (targetType === "card_type") {
    return context.card?.type === targetKey
  }

  return false
}

/**
 * Compare counter value using a rule operator
 */
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

/**
 * Get actual value from state based on condition source
 */
function getSelectionConditionActualValue(
  condition: SelectionCondition,
  state: GameState,
  context?: SelectionCandidateContext
) {
  if (condition.source === "counter") {
    return Number(state.interactions?.counters?.[condition.key] || 0)
  }

  if (condition.source === "stat") {
    return Number(state.stats[condition.key] || 0)
  }

  if (condition.source === "world") {
    return resolveWorldValue(state, condition.key)
  }

  if (condition.source === "deck") {
    const deck = context?.deck
    if (!deck) return ""

    if (condition.key === "id") return deck.id
    if (condition.key === "type") return deck.type
    if (condition.key === "name") return deck.name
    if (condition.key === "repeatable") return deck.repeatable
    if (condition.key === "weight") return deck.weight
    return ""
  }

  if (condition.source === "card") {
    const card = context?.card
    if (!card) return ""

    if (condition.key === "id") return card.id
    if (condition.key === "type") return card.type
    if (condition.key === "title") return card.title
    if (condition.key === "priority") return typeof card.priority === "number" ? card.priority : ""
    if (condition.key === "deckId") return card.deckId
    return ""
  }

  return Boolean(state.flags[condition.key])
}

/**
 * Resolve world state value
 */
function resolveWorldValue(state: GameState, key: string) {
  if (key in state.world) return state.world[key]
  return undefined
}

/**
 * Check if selection conditions match current state
 */
function areSelectionConditionsMatching(
  conditions: SelectionCondition[] | undefined,
  state: GameState,
  context?: SelectionCandidateContext
) {
  if (!conditions || conditions.length === 0) return true

  for (const condition of conditions) {
    const actual = getSelectionConditionActualValue(condition, state, context)
    if (!compareRuleValue(actual ?? "", condition.operator, condition.value)) {
      return false
    }
  }

  return true
}

function areRuleFiltersMatching(
  filters: SelectionWeightRule["filters"],
  state: GameState
) {
  if (!filters) return true

  if (filters.phase && String(state.world.phase || "") !== filters.phase) {
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

/**
 * Check if weight rule applies to the current candidate
 */
function isWeightRuleMatchingCandidate(
  rule: SelectionWeightRule,
  state: GameState,
  context: SelectionCandidateContext
) {
  if (!isRuleTargetMatching(rule.targetType, rule.targetKey, context)) {
    return false
  }

  if (rule.conditions && rule.conditions.length > 0) {
    return areSelectionConditionsMatching(rule.conditions, state, context)
  }

  if (rule.whenCounter) {
    const currentCounter = Number(state.interactions?.counters?.[rule.whenCounter.counterKey] || 0)
    if (!compareCounterCondition(currentCounter, rule.whenCounter.operator, rule.whenCounter.value)) {
      return false
    }
  }

  return areRuleFiltersMatching(rule.filters, state)
}

/**
 * Check if constraint rule applies to the current candidate
 */
function isConstraintRuleMatchingCandidate(
  rule: SelectionConstraintRule,
  state: GameState,
  context: SelectionCandidateContext
) {
  if (!isRuleTargetMatching(rule.targetType, rule.targetKey, context)) {
    return false
  }

  if (rule.conditions && rule.conditions.length > 0) {
    return areSelectionConditionsMatching(rule.conditions, state, context)
  }

  if (rule.whenCounter) {
    const currentCounter = Number(state.interactions?.counters?.[rule.whenCounter.counterKey] || 0)
    if (!compareCounterCondition(currentCounter, rule.whenCounter.operator, rule.whenCounter.value)) {
      return false
    }
  }

  return areRuleFiltersMatching(rule.filters, state)
}

/**
 * Check if a constraint rule is blocking the card by counter
 */
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

/**
 * Check if a card is allowed by constraint rules
 */
function isCardAllowedByConstraints(
  card: PlayRuntimeCard,
  bundle: PlayRuntimeBundle,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  const deck = bundle.decks.find((item) => item.id === card.deckId)
  if (!deck) return true
  const context: SelectionCandidateContext = { deck, card }

  for (const rule of logicConfig.constraintRules || []) {
    if (!isConstraintRuleMatchingCandidate(rule, state, context)) {
      continue
    }

    if (isConstraintRuleBlockingByCounter(rule, state)) {
      return false
    }
  }

  return true
}

/**
 * Get base deck weight
 */
function getDeckWeight(deck: PlayRuntimeDeck | undefined): number {
  if (!deck) return 1
  return Number.isFinite(deck.weight) && deck.weight > 0 ? deck.weight : 1
}

/**
 * Get effective deck weight considering all weight rules
 */
function getEffectiveCardWeight(
  deck: PlayRuntimeDeck,
  card: PlayRuntimeCard,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  let nextWeight = getDeckWeight(deck)
  const context: SelectionCandidateContext = { deck, card }

  for (const rule of logicConfig.weightRules || []) {
    if (!isWeightRuleMatchingCandidate(rule, state, context)) {
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

/**
 * Evaluate card conditions and return detailed evaluation info
 */
function evaluateCardConditions(card: PlayRuntimeCard, state: GameState): CardConditionEvaluation[] {
  return card.conditions.map((condition) => {
    const expected = String(condition.value ?? "")
    const passed = evaluateCondition(condition as any, state)

    // Get actual value based on data type
    let actualValue: string
    switch (condition.dataType) {
      case "stat":
        actualValue = String(Number(state.stats[condition.key] || 0))
        break
      case "flag":
        actualValue = String(state.flags[condition.key] === true)
        break
      case "world_state":
        actualValue = String(state.world[condition.key] || "")
        break
      default:
        actualValue = "unknown"
    }

    return {
      type: `${condition.dataType}:${condition.operator}`,
      key: condition.key,
      expected,
      actual: actualValue,
      passed,
    }
  })
}

/**
 * Check if card meets all its conditions
 */
function areCardConditionsMet(card: PlayRuntimeCard, state: GameState): boolean {
  if (!card.conditions || card.conditions.length === 0) {
    return true
  }

  return card.conditions.every((cond) => evaluateCondition(cond as any, state))
}

/**
 * Check if deck meets its flag-only conditions
 */
function areDeckConditionsMet(deck: PlayRuntimeDeck | undefined, state: GameState): boolean {
  if (!deck || !deck.conditions || deck.conditions.length === 0) {
    return true
  }

  let result: boolean | null = null

  for (const deckCondition of deck.conditions) {
    const current = evaluateCondition(
      {
        dataType: "flag",
        operator: deckCondition.operator as any,
        key: deckCondition.key,
        value: "true",
      } as any,
      state
    )

    if (result === null) {
      result = current
      continue
    }

    if ((deckCondition.logicOperator || "AND") === "OR") {
      result = result || current
    } else {
      result = result && current
    }
  }

  return result ?? true
}

/**
 * Build seen card ids by deck from persisted state and history fallback
 */
function getSeenCardsByDeckMap(bundle: PlayRuntimeBundle, state: GameState) {
  const seen = new Map<string, Set<string>>()

  for (const [deckId, cardIds] of Object.entries(state.seenCardsByDeck || {})) {
    seen.set(deckId, new Set(cardIds || []))
  }

  const cardDeckMap = new Map(bundle.cards.map((card) => [card.id, card.deckId]))
  for (const entry of state.history || []) {
    const deckId = cardDeckMap.get(entry.cardId)
    if (!deckId) continue
    if (!seen.has(deckId)) {
      seen.set(deckId, new Set())
    }
    seen.get(deckId)?.add(entry.cardId)
  }

  return seen
}

function buildDeckIncomingLinks(bundle: PlayRuntimeBundle) {
  const incomingByCard = new Map<string, Set<string>>()
  const cardsById = new Map(bundle.cards.map((card) => [card.id, card]))

  for (const card of bundle.cards) {
    for (const option of card.options || []) {
      if (!option.nextCardId) continue
      const nextCard = cardsById.get(option.nextCardId)
      if (!nextCard) continue

      // Level progression is enforced only within the same deck.
      if (nextCard.deckId !== card.deckId) continue

      if (!incomingByCard.has(nextCard.id)) {
        incomingByCard.set(nextCard.id, new Set())
      }
      incomingByCard.get(nextCard.id)?.add(card.id)
    }
  }

  return incomingByCard
}

function isCardUnlockedByDeckProgress(
  card: PlayRuntimeCard,
  incomingByCard: Map<string, Set<string>>,
  seenByDeck: Map<string, Set<string>>
) {
  const prerequisites = incomingByCard.get(card.id)
  if (!prerequisites || prerequisites.size === 0) {
    return true
  }

  const seenInDeck = seenByDeck.get(card.deckId) || new Set<string>()
  for (const predecessorId of prerequisites) {
    if (seenInDeck.has(predecessorId)) {
      return true
    }
  }

  return false
}

/**
 * Keep no-repeat behavior per deck, but gracefully fallback when deck is exhausted
 */
function filterNoRepeatCardsPerDeck(
  cards: PlayRuntimeCard[],
  seenByDeck: Map<string, Set<string>>,
  decksById: Map<string, PlayRuntimeDeck>
) {
  const cardsByDeck = new Map<string, PlayRuntimeCard[]>()
  for (const card of cards) {
    if (!cardsByDeck.has(card.deckId)) {
      cardsByDeck.set(card.deckId, [])
    }
    cardsByDeck.get(card.deckId)?.push(card)
  }

  const selected: PlayRuntimeCard[] = []

  for (const [deckId, deckCards] of cardsByDeck.entries()) {
    const deck = decksById.get(deckId)
    if (deck?.repeatable) {
      // Repeatable decks can re-enter already seen cards.
      selected.push(...deckCards)
      continue
    }

    const seenSet = seenByDeck.get(deckId) || new Set<string>()
    const unseen = deckCards.filter((card) => !seenSet.has(card.id))
    selected.push(...unseen)
  }

  return selected
}

function pickRandomCard(cards: PlayRuntimeCard[]) {
  if (cards.length === 0) return null
  const index = Math.floor(Math.random() * cards.length)
  return cards[index] || null
}

function getFrontierCardsByDeck(cards: PlayRuntimeCard[]) {
  const byDeck = new Map<string, PlayRuntimeCard[]>()

  for (const card of cards) {
    if (!byDeck.has(card.deckId)) {
      byDeck.set(card.deckId, [])
    }
    byDeck.get(card.deckId)?.push(card)
  }

  const frontier: PlayRuntimeCard[] = []

  for (const deckCards of byDeck.values()) {
    if (deckCards.length === 0) continue

    let minPriority = Number.POSITIVE_INFINITY
    for (const card of deckCards) {
      minPriority = Math.min(minPriority, normalizeCardPriority(card.priority))
    }

    const topPriorityCards = deckCards.filter(
      (card) => normalizeCardPriority(card.priority) === minPriority
    )
    const picked = pickRandomCard(topPriorityCards)
    if (picked) frontier.push(picked)
  }

  return frontier
}

function selectCardFromFrontierByPriorityAndWeight(
  cards: PlayRuntimeCard[],
  decksById: Map<string, PlayRuntimeDeck>,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  if (cards.length === 0) return null

  let minPriority = Number.POSITIVE_INFINITY
  for (const card of cards) {
    minPriority = Math.min(minPriority, normalizeCardPriority(card.priority))
  }

  const priorityCandidates = cards.filter(
    (card) => normalizeCardPriority(card.priority) === minPriority
  )

  let maxWeight = Number.NEGATIVE_INFINITY
  const weighted = priorityCandidates.map((card) => {
    const deck = decksById.get(card.deckId)
    const weight = deck ? getEffectiveCardWeight(deck, card, state, logicConfig) : 1
    maxWeight = Math.max(maxWeight, weight)
    return { card, weight }
  })

  const topWeightCandidates = weighted
    .filter((entry) => entry.weight === maxWeight)
    .map((entry) => entry.card)

  return pickRandomCard(topWeightCandidates)
}

/**
 * Sort cards by priority (asc), tie-breaking by effective deck/card weight (desc)
 */
function sortByPriorityThenWeight(
  cards: PlayRuntimeCard[],
  decksById: Map<string, PlayRuntimeDeck>,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  const scored = cards.map((card) => {
    const deck = decksById.get(card.deckId)
    const weight = deck ? getEffectiveCardWeight(deck, card, state, logicConfig) : 1
    return { card, weight, priority: normalizeCardPriority(card.priority) }
  })

  scored.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    if (a.weight !== b.weight) {
      return b.weight - a.weight
    }
    return a.card.id.localeCompare(b.card.id)
  })

  return scored.map((s) => s.card)
}

/**
 * Pick a card from the valid pool (fallback if none pass constraints)
 */
function pickCardFromValidPool(
  cards: PlayRuntimeCard[],
  decksById: Map<string, PlayRuntimeDeck>,
  state: GameState,
  logicConfig: GameLogicConfig
) {
  if (cards.length === 0) return null

  const sorted = sortByPriorityThenWeight(cards, decksById, state, logicConfig)
  return sorted[0] || null
}

function withSelectionTracking(
  state: GameState,
  enabledDeckIds: string[],
  selectedCard?: PlayRuntimeCard
) {
  const nextSeen = { ...(state.seenCardsByDeck || {}) }

  if (selectedCard) {
    const current = new Set(nextSeen[selectedCard.deckId] || [])
    current.add(selectedCard.id)
    nextSeen[selectedCard.deckId] = Array.from(current)
  }

  return {
    ...state,
    enabledDeckIds,
    seenCardsByDeck: nextSeen,
  }
}

/**
 * Draw the next card from the game
 * Handles:
 * - Active sequences (directed card paths)
 * - Valid card filtering (conditions)
 * - Weight-based selection
 * - Constraint checking
 * - Completed deck filtering
 */
export function drawNextCard(
  bundle: PlayRuntimeBundle,
  state: GameState,
  excludeCardId?: string
): DrawResult {
  const logicConfig = normalizeGameLogicConfig(bundle)
  const ruleEvents: RuntimeRuleTraceEntry[] = []
  const decksById = new Map(bundle.decks.map((deck) => [deck.id, deck]))
  const completedDecks = Array.isArray(state.completedDecks) ? state.completedDecks : []
  const enabledDeckIds = bundle.decks
    .filter((deck) => areDeckConditionsMet(deck, state))
    .map((deck) => deck.id)
  const seenByDeck = getSeenCardsByDeckMap(bundle, state)
  const incomingByCard = buildDeckIncomingLinks(bundle)
  const stateWithTracking = withSelectionTracking(state, enabledDeckIds)
  let stateForSelection: GameState = stateWithTracking

  const debugEntries = bundle.cards.map((card) => {
    const evaluations = evaluateCardConditions(card, state)
    const valid = areCardConditionsMet(card, state)
    return {
      cardId: card.id,
      title: card.title,
      evaluations,
      valid,
    }
  })

  // Handle active sequence (directed card path)
  if (state.activeSequence?.currentCardId) {
    const sequenceCard = bundle.cards.find((card) => card.id === state.activeSequence?.currentCardId)
    if (!sequenceCard) {
      stateForSelection = {
        ...stateForSelection,
        activeSequence: undefined,
      }
    } else {
      const sequenceDeck = decksById.get(sequenceCard.deckId)
      const cardConditionsMet = areCardConditionsMet(sequenceCard, state)
      const deckEnabled = !!sequenceDeck && enabledDeckIds.includes(sequenceDeck.id)
      const valid = cardConditionsMet && deckEnabled

      const lastHistoryEntry = state.history[state.history.length - 1]
      const previousCard = lastHistoryEntry
        ? bundle.cards.find((card) => card.id === lastHistoryEntry.cardId)
        : undefined
      const isSameDeckAsPrevious = !!previousCard && previousCard.deckId === sequenceCard.deckId
      const shouldPause = isSameDeckAsPrevious && !cardConditionsMet

      if (!valid) {
        stateForSelection = shouldPause
          ? applyGameLogicEvent(
              {
                ...stateForSelection,
                activeSequence: undefined,
              },
              logicConfig,
              {
                type: "sequence_paused",
                cardId: sequenceCard.id,
                deckId: sequenceDeck?.id,
                deckType: sequenceDeck?.type,
              },
              ruleEvents
            )
          : {
              ...stateForSelection,
              activeSequence: undefined,
            }
      } else {
        const shownTrackedState = withSelectionTracking(stateWithTracking, enabledDeckIds, sequenceCard)
        const stateWithStartedEvent = state.activeSequence?.started
          ? shownTrackedState
          : applyGameLogicEvent(
              {
                ...shownTrackedState,
                activeSequence: {
                  currentCardId: sequenceCard.id,
                  started: true,
                },
              },
              logicConfig,
              {
                type: "sequence_started",
                cardId: sequenceCard.id,
                deckId: sequenceDeck?.id,
                deckType: sequenceDeck?.type,
              },
              ruleEvents
            )

        const nextState = applyGameLogicEvent(stateWithStartedEvent, logicConfig, {
          type: "card_shown",
          cardId: sequenceCard.id,
          deckId: sequenceDeck?.id,
          deckType: sequenceDeck?.type,
        }, ruleEvents)

        return {
          state: nextState,
          card: sequenceCard,
          debug: debugEntries,
          ruleEvents,
        }
      }
    }
  }

  // Filter valid cards
  const validCards = bundle.cards
    .filter((card) => areCardConditionsMet(card, stateForSelection))
    .filter((card) => isCardUnlockedByDeckProgress(card, incomingByCard, seenByDeck))

  // Filter cards from completed non-repeatable decks
  let cardsFromRepeatableDecks = validCards.filter((card) => {
    const deck = decksById.get(card.deckId)
    if (!deck) return true

    if (!enabledDeckIds.includes(deck.id)) {
      return false
    }

    if (deck.repeatable === false && completedDecks.includes(card.deckId)) {
      return false
    }

    return true
  })

  cardsFromRepeatableDecks = filterNoRepeatCardsPerDeck(cardsFromRepeatableDecks, seenByDeck, decksById)

  if (excludeCardId) {
    const filtered = cardsFromRepeatableDecks.filter((card) => card.id !== excludeCardId)
    if (filtered.length > 0) {
      cardsFromRepeatableDecks = filtered
    }
  }

  if (cardsFromRepeatableDecks.length === 0) {
    return {
      state: stateForSelection,
      card: null,
      debug: debugEntries,
      message: "No cards available from non-completed decks.",
      ruleEvents,
    }
  }

  const frontierCards = getFrontierCardsByDeck(cardsFromRepeatableDecks)
  const constrainedCards = frontierCards.filter((card) =>
    isCardAllowedByConstraints(card, bundle, stateForSelection, logicConfig)
  )

  if (constrainedCards.length === 0) {
    return {
      state: stateForSelection,
      card: null,
      debug: debugEntries,
      message: "No cards available - constraints not met.",
      ruleEvents,
    }
  }

  const selected =
    selectCardFromFrontierByPriorityAndWeight(constrainedCards, decksById, stateForSelection, logicConfig) ||
    pickCardFromValidPool(constrainedCards, decksById, stateForSelection, logicConfig)

  if (!selected) {
    return {
      state: stateForSelection,
      card: null,
      debug: debugEntries,
      message: "No cards available after tie-break selection.",
      ruleEvents,
    }
  }

  const shownTrackedState = withSelectionTracking(stateForSelection, enabledDeckIds, selected)
  const selectedDeck = decksById.get(selected.deckId)
  const nextState = applyGameLogicEvent(shownTrackedState, logicConfig, {
    type: "card_shown",
    cardId: selected.id,
    deckId: selectedDeck?.id,
    deckType: selectedDeck?.type,
  }, ruleEvents)

  return {
    state: nextState,
    card: selected,
    debug: debugEntries,
    ruleEvents,
  }
}