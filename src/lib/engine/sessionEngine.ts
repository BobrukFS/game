/**
 * Session Engine - Manages game session state initialization and persistence
 * Responsibilities:
 * - Build initial game state from bundle
 * - Save game sessions
 * - Load game sessions
 * - Reset sessions
 */

import { GameState } from "@/lib/domain"
import { PlayRuntimeBundle } from "@/lib/services/prisma/playRuntime"

/**
 * Parse world state value based on type (number, boolean, string)
 */
function parseWorldStateValue(valueType: string, value: string): string | number | boolean | string[] {
  if (valueType === "number") {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }

  if (valueType === "boolean") {
    return value === "true"
  }

  if (valueType === "array") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item))
      }
    } catch {
      return []
    }
    return []
  }

  return value
}

/**
 * Build initial game state from bundle configuration
 * Initializes all stats, world state, counters, and empty history
 */
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
    enabledDeckIds: bundle.decks.map((deck) => deck.id),
    seenCardsByDeck: {},
    interactions: {
      total: counters["interactions.total"] || 0,
      counters,
    },
    history: [],
  }
}

/**
 * Save game session to persistent storage (localStorage, database, etc.)
 * Returns serialized state that can be stored
 */
export function saveGameSession(gameId: string, state: GameState): string {
  return JSON.stringify({
    gameId,
    timestamp: new Date().toISOString(),
    state,
  })
}

/**
 * Load game session from persistent storage
 * Validates and returns the state if valid
 */
export function loadGameSession(sessionData: string): GameState | null {
  try {
    const parsed = JSON.parse(sessionData)
    if (!parsed.state || typeof parsed.state !== "object") {
      return null
    }
    const loaded = parsed.state as GameState
    return {
      ...loaded,
      enabledDeckIds: Array.isArray(loaded.enabledDeckIds) ? loaded.enabledDeckIds : [],
      seenCardsByDeck: loaded.seenCardsByDeck || {},
    }
  } catch {
    return null
  }
}

/**
 * Reset game session to initial state (for restarting a game)
 */
export function resetGameSession(bundle: PlayRuntimeBundle): GameState {
  return buildInitialGameState(bundle)
}

/**
 * Build complete game session object with metadata
 */
export function buildGameSession(bundle: PlayRuntimeBundle, resumedState?: GameState | null) {
  const state = resumedState || buildInitialGameState(bundle)
  
  return {
    gameId: bundle.game?.id,
    gameName: bundle.game?.name,
    state,
    createdAt: new Date(),
    resumed: !!resumedState,
  }
}

/**
 * Mark a deck as completed (one-way operation)
 * Used when a deck's narrative/sequence is finished
 */
export function markDeckCompleted(state: GameState, deckId: string): GameState {
  const completedDecks = Array.isArray(state.completedDecks) ? state.completedDecks : []
  
  if (!completedDecks.includes(deckId)) {
    completedDecks.push(deckId)
  }

  return {
    ...state,
    completedDecks,
  }
}

/**
 * Reset completed decks (for testing or special scenarios)
 */
export function resetCompletedDecks(state: GameState): GameState {
  return {
    ...state,
    completedDecks: [],
  }
}
