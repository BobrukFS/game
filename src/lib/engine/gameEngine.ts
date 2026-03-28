import { Card, GameLogicConfig, GameState, Option } from "@/lib/domain"
import { drawFromCyclePool } from "./selectionEngine"
import { applyEffects } from "./effectEngine"
import { applyGameLogicEvent, applyGameLogicEvents } from "./ruleEngine"

function collectChangedStatEvents(previous: GameState, next: GameState) {
  const keys = new Set([...Object.keys(previous.stats || {}), ...Object.keys(next.stats || {})])
  const events: { type: "stat_changed"; statKey: string }[] = []

  keys.forEach((key) => {
    const before = Number(previous.stats[key] || 0)
    const after = Number(next.stats[key] || 0)
    if (before !== after) {
      events.push({ type: "stat_changed", statKey: key })
    }
  })

  return events
}

export function drawCardWithState(
  cards: Card[],
  state: GameState,
  logicConfig?: GameLogicConfig
): { card: Card | null; state: GameState } {
  const selectedCard = state.activeSequence
    ? cards.find(card => card.id === state.activeSequence?.currentCardId) ?? null
    : drawFromCyclePool(cards, state)

  if (!selectedCard) {
    return { card: null, state }
  }

  const updatedState = applyGameLogicEvent(state, logicConfig, {
    type: "card_shown",
    cardId: selectedCard.id,
  })

  return { card: selectedCard, state: updatedState }
}

export function drawCard(cards: Card[], state: GameState): Card | null {
  return drawCardWithState(cards, state).card
}

export function applyOption(
  option: Option,
  state: GameState,
  logicConfig?: GameLogicConfig
): GameState {
  const updatedState = applyEffects(option.effects, state)
  const statChangeEvents = collectChangedStatEvents(state, updatedState)
  const nextHistory = [
    ...updatedState.history,
    { cardId: option.cardId, optionId: option.id }
  ]

  const afterOptionResolved = applyGameLogicEvent(
    {
      ...updatedState,
      history: nextHistory,
    },
    logicConfig,
    {
      type: "option_resolved",
      cardId: option.cardId,
      optionId: option.id,
    }
  )

  const withStatRules = applyGameLogicEvents(afterOptionResolved, logicConfig, statChangeEvents)

  if (option.nextCardId) {
    return applyGameLogicEvent({
      ...withStatRules,
      activeSequence: { currentCardId: option.nextCardId },
    }, logicConfig, {
      type: "sequence_started",
      cardId: option.nextCardId,
      optionId: option.id,
    })
  }

  return applyGameLogicEvent({
    ...withStatRules,
    activeSequence: undefined,
  }, logicConfig, {
    type: "sequence_completed",
    cardId: option.cardId,
    optionId: option.id,
  })
}