import { prisma } from "@/lib/prisma"

export async function getGameLogicByGameId(gameId: string) {
  return prisma.gameLogicConfig.findUnique({
    where: { gameId },
  })
}

export async function upsertGameLogicByGameId(data: {
  gameId: string
  counters: unknown[]
  rules: unknown[]
}) {
  return prisma.gameLogicConfig.upsert({
    where: { gameId: data.gameId },
    create: {
      gameId: data.gameId,
      counters: data.counters,
      rules: data.rules,
    },
    update: {
      counters: data.counters,
      rules: data.rules,
    },
  })
}
