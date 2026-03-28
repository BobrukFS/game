// src/hooks/useGame.ts
// ⚠️ DEPRECATED - Use RuntimeSession component instead
// This hook is for backward compatibility only. New code should use src/components/runtime/RuntimeSession.tsx

"use client"

import { useState } from "react"
import { GameState, Card, Option } from "@/lib/domain"
import { cards } from "@/lib/data/cards"

export function useGame() {
  const [state, setState] = useState<GameState>({
    stats: {
      gold: 5,
      suspicion: 0,
      lucidity: 5
    },
    inventory: [],
    flags: {},
    world: {
      day: 1,
      phase: "day"
    },
    interactions: {
      total: 0,
      counters: {},
    },
    completedDecks: [],
    enabledDeckIds: [],
    seenCardsByDeck: {},
    history: []
  })

  const [currentCard, setCurrentCard] = useState<Card | null>(null)

  // ⚠️ DEPRECATED - These functions no longer work
  function startGame() {
    console.warn("useGame.startGame() is DEPRECATED. Use RuntimeSession component instead.")
  }

  function chooseOption(option: Option) {
    console.warn("useGame.chooseOption() is DEPRECATED. Use RuntimeSession component instead.")
  }

  return {
    state,
    currentCard,
    startGame,
    chooseOption
  }
}