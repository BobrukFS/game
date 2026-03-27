import { prisma } from "@/lib/prisma"

export async function getWorldStatesByGameId(gameId: string) {
  return prisma.worldState.findMany({
    where: { gameId },
    orderBy: { key: "asc" },
  })
}

export async function getWorldStateByKey(gameId: string, key: string) {
  return prisma.worldState.findUnique({
    where: {
      gameId_key: {
        gameId,
        key,
      },
    },
  })
}

export async function createWorldState(data: {
  gameId: string
  key: string
  valueType: string
  value: string
}) {
  return prisma.worldState.create({
    data,
  })
}

export async function updateWorldState(
  id: string,
  data: Partial<{ key: string; valueType: string; value: string }>
) {
  return prisma.worldState.update({
    where: { id },
    data,
  })
}

export async function deleteWorldState(id: string) {
  return prisma.worldState.delete({
    where: { id },
  })
}
