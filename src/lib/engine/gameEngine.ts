import { Card, GameState, Option } from "@/lib/domain"
import { drawFromCyclePool } from "./selectionEngine"
import { applyEffects } from "./effectEngine"

export function drawCard(cards: Card[], state: GameState): Card | null {
  if (state.activeSequence) {
    return cards.find(card => card.id === state.activeSequence?.currentCardId) ?? null
  }

  return drawFromCyclePool(cards, state)
}

export function applyOption(
  option: Option,
  state: GameState
): GameState {
  const updatedState = applyEffects(option.effects, state)
  const nextHistory = [
    ...updatedState.history,
    { cardId: option.cardId, optionId: option.id }
  ]

  if (option.nextCardId) {
    return {
      ...updatedState,
      activeSequence: { currentCardId: option.nextCardId },
      history: nextHistory
    }
  }

  return {
    ...updatedState,
    activeSequence: undefined,
    history: nextHistory
  }
}