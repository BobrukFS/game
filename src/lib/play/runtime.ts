/**
 * Runtime Orchestrator - Thin coordinator for the game engine
 * 
 * Delegates to specialized engines:
 * - sessionEngine: State initialization and persistence
 * - selectionEngine: Card selection with constraints and weights
 * - effectEngine: Effect application (stats, flags, world)
 * - ruleEngine: Rule processing and logic events
 * 
 * Runtime should be minimal and only orchestrate.
 * All heavy lifting is done by the engines.
 */

import { GameState, GameLogicConfig } from "@/lib/domain"
import { applyGameLogicEvent, applyGameLogicEvents } from "@/lib/engine/ruleEngine"
import { RuntimeRuleTraceEntry } from "@/lib/engine/ruleEngine"
import { applyEffects } from "@/lib/engine/effectEngine"
import {
  buildInitialGameState as buildInitialState,
  saveGameSession as saveSession,
  loadGameSession as loadSession,
  resetGameSession as resetSession,
  buildGameSession as buildSession,
  markDeckCompleted,
} from "@/lib/engine/sessionEngine"
import {
  drawNextCard as selectNextCard,
  DrawResult,
  CardDebugEntry,
  CardConditionEvaluation,
} from "@/lib/engine/selectionEngine"
import {
  PlayRuntimeBundle,
  PlayRuntimeOption,
} from "@/lib/services/prisma/playRuntime"

// Re-export from selectionEngine
export type { DrawResult, CardDebugEntry, CardConditionEvaluation }

/**
 * Build initial game state
 * Delegates to sessionEngine
 */
export function buildInitialGameState(bundle: PlayRuntimeBundle): GameState {
  return buildInitialState(bundle)
}

/**
 * Draw next card from the game
 * Delegates to selectionEngine for all selection logic
 */
export function drawNextCard(
  bundle: PlayRuntimeBundle,
  state: GameState,
  excludeCardId?: string
): DrawResult {
  return selectNextCard(bundle, state, excludeCardId)
}

function buildLogicConfig(bundle: PlayRuntimeBundle): GameLogicConfig {
  return {
    counters: bundle.logic?.counters || [],
    rules: bundle.logic?.rules || [],
    constraintRules: bundle.logic?.constraintRules || [],
    weightRules: bundle.logic?.weightRules || [],
  }
}

export function pauseActiveSequence(
  bundle: PlayRuntimeBundle,
  state: GameState,
  metadata?: { cardId?: string; optionId?: string }
): { state: GameState; events: RuntimeRuleTraceEntry[] } {
  const logicConfig = buildLogicConfig(bundle)
  const events: RuntimeRuleTraceEntry[] = []
  const pausedCard = metadata?.cardId
    ? bundle.cards.find((entry) => entry.id === metadata.cardId)
    : undefined
  const pausedDeck = pausedCard
    ? bundle.decks.find((entry) => entry.id === pausedCard.deckId)
    : undefined

  const nextState = applyGameLogicEvent(
    {
      ...state,
      activeSequence: undefined,
    },
    logicConfig,
    {
      type: "sequence_paused",
      cardId: metadata?.cardId,
      optionId: metadata?.optionId,
      deckId: pausedDeck?.id,
      deckType: pausedDeck?.type,
    },
    events
  )

  return { state: nextState, events }
}

export function advanceCardWithoutOption(
  bundle: PlayRuntimeBundle,
  state: GameState,
  cardId: string
): { state: GameState; events: RuntimeRuleTraceEntry[] } {
  const card = bundle.cards.find((entry) => entry.id === cardId)
  if (!card) {
    return { state, events: [] }
  }
  const deck = bundle.decks.find((entry) => entry.id === card.deckId)

  const logicConfig = buildLogicConfig(bundle)
  const events: RuntimeRuleTraceEntry[] = []

  const isActiveSequenceCard = state.activeSequence?.currentCardId === cardId
  const isStandaloneCard = !state.activeSequence

  if (!isActiveSequenceCard && !isStandaloneCard) {
    return { state, events }
  }

  let nextState = markDeckCompleted(state, card.deckId)
  nextState = applyGameLogicEvent(
    {
      ...nextState,
      activeSequence: undefined,
    },
    logicConfig,
    {
      type: "sequence_completed",
      cardId,
      deckId: deck?.id,
      deckType: deck?.type,
    },
    events
  )

  return { state: nextState, events }
}

/**
 * Apply effects from an option and process rules
 * Uses: effectEngine, ruleEngine, sessionEngine
 */
function applyOptionEffects(state: GameState, option: PlayRuntimeOption) {
  // Delegate effect application to effectEngine
  return applyEffects(option.effects as unknown as Array<{type: string, key: string, value: string}>, state)
}

/**
 * Collect stat change events for the session
 */
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

/**
 * Apply selected option to current game state
 * 
 * Flow:
 * 1. Apply effects using effectEngine
 * 2. Apply rules using ruleEngine  
 * 3. Mark deck completed if needed using sessionEngine
 * 4. Handle sequences (nextCardId)
 */
export function applySelectedOption(
  bundle: PlayRuntimeBundle,
  state: GameState,
  cardId: string,
  optionId: string
): { state: GameState; message?: string; events: RuntimeRuleTraceEntry[] } {
  // Find the card and option
  const card = bundle.cards.find((c) => c.id === cardId)
  if (!card) {
    return { state, message: "Card not found", events: [] }
  }

  const option = card.options.find((opt) => opt.id === optionId)
  if (!option) {
    return { state, message: "Option not found", events: [] }
  }

  const logicConfig = buildLogicConfig(bundle)
  const events: RuntimeRuleTraceEntry[] = []

  // 1. Apply effects
  const afterEffects = applyOptionEffects(state, option)
  const statEvents = collectChangedStatEvents(state, afterEffects)

  // 2. Record history
  const withHistory: GameState = {
    ...afterEffects,
    history: [...afterEffects.history, { cardId, optionId }],
  }

  // 3. Apply rules
  const cardDeck = bundle.decks.find((entry) => entry.id === card.deckId)
  let nextState = applyGameLogicEvent(withHistory, logicConfig, {
    type: "option_resolved",
    cardId,
    optionId,
    deckId: cardDeck?.id,
    deckType: cardDeck?.type,
  }, events)

  nextState = applyGameLogicEvents(nextState, logicConfig, statEvents, events)

  // 4. Handle sequences
  if (option.nextCardId) {
    const preserveStarted = state.activeSequence?.started === true
    return {
      state: {
        ...nextState,
        activeSequence: { currentCardId: option.nextCardId, started: preserveStarted },
      },
      events,
    }
  }

  // 5. Mark deck as completed
  nextState = markDeckCompleted(nextState, card.deckId)

  nextState = applyGameLogicEvent(
    {
      ...nextState,
      activeSequence: undefined,
    },
    logicConfig,
    {
      type: "sequence_completed",
      cardId,
      optionId,
      deckId: cardDeck?.id,
      deckType: cardDeck?.type,
    },
    events
  )

  return { state: nextState, events }
}

/**
 * Build a complete game session from a bundle
 * Optionally resume from saved state
 */
export function buildGameSession(bundle: PlayRuntimeBundle, resumedState?: GameState | null) {
  return buildSession(bundle, resumedState)
}

/**
 * Save game session to storage
 */
export function saveGameSession(gameId: string, state: GameState): string {
  return saveSession(gameId, state)
}

/**
 * Load game session from storage
 */
export function loadGameSession(sessionData: string): GameState | null {
  return loadSession(sessionData)
}

/**
 * Reset game session to initial state
 */
export function resetGameSession(bundle: PlayRuntimeBundle): GameState {
  return resetSession(bundle)
}
