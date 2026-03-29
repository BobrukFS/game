import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

type LogicEditorBootstrapRow = {
  id: string
  name: string
  type: string
  weight: number
}

export async function getGameLogicByGameId(gameId: string) {
  return prisma.gameLogicConfig.findUnique({
    where: { gameId },
  })
}

export async function getLogicEditorBootstrapByGameId(gameId: string) {
  const [config, stats, worldStates, decks] = await prisma.$transaction([
    prisma.gameLogicConfig.findUnique({
      where: { gameId },
      select: {
        counters: true,
        rules: true,
        weightRules: true,
        constraintRules: true,
      },
    }),
    prisma.stat.findMany({
      where: { gameId },
      select: { key: true },
      orderBy: { key: "asc" },
    }),
    prisma.worldState.findMany({
      where: { gameId },
      select: { key: true },
      orderBy: { key: "asc" },
    }),
    prisma.deck.findMany({
      where: { gameId },
      select: {
        id: true,
        name: true,
        type: true,
        weight: true,
      },
      orderBy: { name: "asc" },
    }),
  ])

  return {
    config,
    statKeys: stats.map((stat) => stat.key),
    worldStateKeys: worldStates.map((worldState) => worldState.key),
    deckWeights: decks.map((deck): LogicEditorBootstrapRow => ({
      id: deck.id,
      name: deck.name,
      type: deck.type,
      weight: Number.isFinite(deck.weight) && deck.weight > 0 ? deck.weight : 1,
    })),
  }
}

export async function upsertGameLogicByGameId(data: {
  gameId: string
  counters: Prisma.InputJsonValue
  rules: Prisma.InputJsonValue
  weightRules?: Prisma.InputJsonValue
  constraintRules?: Prisma.InputJsonValue
}) {
  return prisma.gameLogicConfig.upsert({
    where: { gameId: data.gameId },
    create: {
      gameId: data.gameId,
      counters: data.counters,
      rules: data.rules,
      weightRules: data.weightRules || [],
      constraintRules: data.constraintRules || [],
    },
    update: {
      counters: data.counters,
      rules: data.rules,
      weightRules: data.weightRules || [],
      constraintRules: data.constraintRules || [],
    },
  })
}
