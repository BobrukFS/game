import { prisma } from "@/lib/prisma"

export async function getStatsByGameId(gameId: string) {
  return prisma.stat.findMany({
    where: { gameId },
    orderBy: { key: "asc" },
  });
}

export async function getStatByKey(
  gameId: string,
  key: string
) {
  return prisma.stat.findUnique({
    where: {
      gameId_key: {
        gameId,
        key,
      },
    },
  });
}

export async function createStat(data: {
  gameId: string;
  key: string;
  value?: number;
  min?: number;
  max?: number;
}) {
  return prisma.stat.create({
    data: {
      gameId: data.gameId,
      key: data.key,
      value: data.value || 0,
      min: data.min || 0,
      max: data.max || 100,
    },
  });
}

export async function updateStat(
  id: string,
  data: Partial<{ value: number; min: number; max: number }>
) {
  return prisma.stat.update({
    where: { id },
    data,
  });
}

export async function deleteStat(id: string) {
  return prisma.stat.delete({
    where: { id },
  });
}
