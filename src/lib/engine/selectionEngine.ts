import { Card, CyclePhase, Deck } from "@/lib/domain"
import { GameState } from "@/lib/domain"
import { canShowCard } from "@/lib/engine/conditionEngine"

export function getValidCards(cards: Card[], state: GameState): Card[] {
  return cards.filter(card => canShowCard(card.conditions, state))
}

export function getCardsForPhase(cards: Card[], phase: CyclePhase): Card[] {
  return cards.filter(card => !card.phase || card.phase === phase)
}

export function weightedRandom(cards: Card[]): Card | null {
  if (cards.length === 0) return null

  const totalWeight = cards.reduce((sum, c) => sum + c.weight, 0)
  const rand = Math.random() * totalWeight

  let acc = 0
  for (const card of cards) {
    acc += card.weight
    if (rand <= acc) return card
  }

  return cards[0]
}

function shuffleCards(cards: Card[]): Card[] {
  const copy = [...cards]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function orderCards(cards: Card[]): Card[] {
  const fixed = cards
    .filter(card => card.cycleOrder !== undefined)
    .sort((a, b) => Number(a.cycleOrder) - Number(b.cycleOrder))
  const random = shuffleCards(cards.filter(card => card.cycleOrder === undefined))
  return [...fixed, ...random]
}

export function buildCyclePool(cards: Card[], state: GameState, decks?: Deck[]): Card[] {
  const phase = state.world.phase
  const deckMap = new Map(decks?.map((d) => [d.id, d]) || [])
  const completedNonRepeatableDecks = new Set(
    state.completedDecks.filter((deckId) => {
      const deck = deckMap.get(deckId)
      return deck && !deck.repeatable
    })
  )

  const validCards = getCardsForPhase(getValidCards(cards, state), phase)
    .filter(card => card.consumesInteraction !== false)
    .filter(card => !completedNonRepeatableDecks.has(card.deckId))

  const mainCandidates = validCards.filter(card => card.eventType === "main")
  const secondaryCandidates = validCards.filter(card => card.eventType === "secondary")
  const randomCandidates = validCards.filter(card => card.eventType === "random")

  const selectedMain = weightedRandom(mainCandidates)
  const selectedSecondary = weightedRandom(secondaryCandidates)

  const pool: Card[] = []
  if (selectedMain) pool.push(selectedMain)
  if (selectedSecondary) pool.push(selectedSecondary)

  if (pool.length === 0) {
    const fallbackNarrative = weightedRandom([...mainCandidates, ...secondaryCandidates])
    if (fallbackNarrative) {
      pool.push(fallbackNarrative)
    }
  }

  const randomPool = shuffleCards(
    randomCandidates.filter(card => !pool.some(selected => selected.id === card.id))
  )

  return orderCards([...pool, ...randomPool])
}

export function drawFromCyclePool(cards: Card[], state: GameState, decks?: Deck[]): Card | null {
  const pool = buildCyclePool(cards, state, decks)
  return pool[0] ?? null
}