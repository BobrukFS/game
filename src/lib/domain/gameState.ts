export interface ActiveSequence {
  currentCardId: string
  started?: boolean
}

export type WorldStateValue = number | string | boolean | string[]

export type WorldStateMap = Record<string, WorldStateValue>

export type InteractionCounterMap = Record<string, number>

export interface GameInteractionState {
  total: number
  counters: InteractionCounterMap
}

export interface GameState {
  stats: Record<string, number>
  inventory: string[]
  flags: Record<string, boolean>
  activeSequence?: ActiveSequence
  activeMainEventId?: string
  activeSecondaryEventIds?: string[]
  interactions?: GameInteractionState
  turn?: number
  world: WorldStateMap
  completedDecks: string[]
  enabledDeckIds?: string[]
  seenCardsByDeck?: Record<string, string[]>
  history: {
    cardId: string
    optionId: string
  }[]
}