import { prisma } from "@/lib/prisma"

export async function getFlagsByGameId(gameId: string) {
  return prisma.flag.findMany({
    where: { gameId },
    orderBy: { key: "asc" },
  })
}

export async function getFlagByKey(gameId: string, key: string) {
  return prisma.flag.findUnique({
    where: {
      gameId_key: {
        gameId,
        key,
      },
    },
  })
}

export async function createFlag(data: { gameId: string; key: string }) {
  return prisma.flag.create({
    data,
  })
}

export async function upsertFlagByKey(gameId: string, key: string) {
  return prisma.flag.upsert({
    where: {
      gameId_key: {
        gameId,
        key,
      },
    },
    create: {
      gameId,
      key,
    },
    update: {},
  })
}

export async function updateFlag(id: string, data: Partial<{ key: string }>) {
  return prisma.flag.update({
    where: { id },
    data,
  })
}

export async function deleteFlag(id: string) {
  return prisma.flag.delete({
    where: { id },
  })
}
