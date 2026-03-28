import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function getGameLogicByGameId(gameId: string) {
  return prisma.gameLogicConfig.findUnique({
    where: { gameId },
  })
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
