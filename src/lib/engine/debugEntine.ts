// src/lib/engine/debugEngine.ts

import { Card, GameState } from "@/lib/domain"
import { evaluateCondition } from "./conditionEngine"

export function debugCards(cards: Card[], state: GameState) {
  return cards.map(card => {
    const evaluations = card.conditions.map(cond => ({
      type: cond.type,
      key: cond.key,
      value: cond.value,
      result: evaluateCondition(cond, state)
    }))

    return {
      id: card.id,
      title: card.title,
      valid: evaluations.every(e => e.result),
      evaluations
    }
  })
}