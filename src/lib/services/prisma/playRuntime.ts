import { prisma } from "@/lib/prisma"
import {
  InteractionCounterConfig,
  InteractionRule,
  SelectionConstraintRule,
  SelectionWeightRule,
} from "@/lib/domain"

export interface PlayRuntimeDeck {
  id: string
  name: string
  type: string
  weight: number
}

export interface PlayRuntimeEffect {
  id: string
  type: string
  key: string
  value: string
}

export interface PlayRuntimeOption {
  id: string
  text: string
  order: number
  nextCardId: string | null
  effects: PlayRuntimeEffect[]
}

export interface PlayRuntimeCondition {
  id: string
  type: string
  key: string
  value: string
}

export interface PlayRuntimeCard {
  id: string
  deckId: string
  title: string
  type: string
  description: string
  priority: number
  tags: string[]
  conditions: PlayRuntimeCondition[]
  options: PlayRuntimeOption[]
}

export interface PlayRuntimeStat {
  key: string
  value: number
  min: number
  max: number
}

export interface PlayRuntimeWorldState {
  key: string
  valueType: string
  value: string
}

export interface PlayRuntimeBundle {
  game: {
    id: string
    name: string
    description: string
  }
  decks: PlayRuntimeDeck[]
  cards: PlayRuntimeCard[]
  stats: PlayRuntimeStat[]
  worldStates: PlayRuntimeWorldState[]
  logic: {
    counters: InteractionCounterConfig[]
    rules: InteractionRule[]
    weightRules: SelectionWeightRule[]
    constraintRules: SelectionConstraintRule[]
  }
}

export async function getPlayRuntimeBundle(gameId: string): Promise<PlayRuntimeBundle | null> {
  const [game, decks, stats, worldStates, logicConfig] = await Promise.all([
    prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        description: true,
      },
    }),
    prisma.deck.findMany({
      where: { gameId },
      select: {
        id: true,
        name: true,
        type: true,
        weight: true,
        cards: {
          select: {
            id: true,
            deckId: true,
            title: true,
            type: true,
            description: true,
            priority: true,
            tags: true,
            conditions: {
              select: {
                id: true,
                type: true,
                key: true,
                value: true,
              },
            },
            options: {
              select: {
                id: true,
                text: true,
                order: true,
                nextCardId: true,
                effects: {
                  select: {
                    id: true,
                    type: true,
                    key: true,
                    value: true,
                  },
                },
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.stat.findMany({
      where: { gameId },
      select: { key: true, value: true, min: true, max: true },
      orderBy: { key: "asc" },
    }),
    prisma.worldState.findMany({
      where: { gameId },
      select: { key: true, valueType: true, value: true },
      orderBy: { key: "asc" },
    }),
    prisma.gameLogicConfig.findUnique({
      where: { gameId },
      select: {
        counters: true,
        rules: true,
        weightRules: true,
        constraintRules: true,
      } as any,
    }),
  ])

  if (!game) {
    return null
  }

  const cards: PlayRuntimeCard[] = decks.flatMap((deck) =>
    deck.cards.map((card) => ({
      id: card.id,
      deckId: card.deckId,
      title: card.title,
      type: card.type,
      description: card.description,
      priority: card.priority,
      tags: card.tags,
      conditions: card.conditions,
      options: card.options,
    }))
  )

  return {
    game,
    decks: decks.map((deck) => ({
      id: deck.id,
      name: deck.name,
      type: deck.type,
      weight: deck.weight,
    })),
    cards,
    stats,
    worldStates,
    logic: {
      counters: ((logicConfig?.counters as unknown as InteractionCounterConfig[]) || []).filter(
        (counter) => !!counter?.key
      ),
      rules: (logicConfig?.rules as unknown as InteractionRule[]) || [],
      weightRules: (logicConfig?.weightRules as unknown as SelectionWeightRule[]) || [],
      constraintRules: ((logicConfig as any)?.constraintRules as SelectionConstraintRule[]) || [],
    },
  }
}
