// src/hooks/useGame.ts

"use client"

import { useState } from "react"
import { GameState, Card, Option } from "@/lib/domain"
import { drawCard, applyOption } from "@/lib/engine/gameEngine"
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
    history: []
  })

  const [currentCard, setCurrentCard] = useState<Card | null>(null)

  function startGame() {
    const card = drawCard(cards, state)
    setCurrentCard(card)
  }

  function chooseOption(option: Option) {
    const newState = applyOption(option, state)
    setState(newState)

    const nextCard = drawCard(cards, newState)
    setCurrentCard(nextCard)
  }

  return {
    state,
    currentCard,
    startGame,
    chooseOption
  }
}