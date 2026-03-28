// src/hooks/useGame.ts

"use client"

import { useState } from "react"
import { GameState, Card, Option } from "@/lib/domain"
import { drawCardWithState, applyOption } from "@/lib/engine/gameEngine"
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
    history: []
  })

  const [currentCard, setCurrentCard] = useState<Card | null>(null)

  function startGame() {
    const result = drawCardWithState(cards, state)
    setState(result.state)
    setCurrentCard(result.card)
  }

  function chooseOption(option: Option) {
    const newState = applyOption(option, state)
    const result = drawCardWithState(cards, newState)
    setState(result.state)
    setCurrentCard(result.card)
  }

  return {
    state,
    currentCard,
    startGame,
    chooseOption
  }
}