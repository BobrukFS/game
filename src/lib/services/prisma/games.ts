import { prisma } from "@/lib/prisma"
import type { Game } from "@prisma/client"

export type { Game }

export async function getAllGames() {
  return prisma.game.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getGameById(id: string): Promise<Game | null> {
  return prisma.game.findUnique({
    where: { id },
  });
}

export async function createGame(data: {
  name: string;
  description?: string;
}) {
  return prisma.game.create({
    data: {
      name: data.name,
      description: data.description || "",
    },
  });
}

export async function updateGame(
  id: string,
  data: Partial<{ name: string; description: string }>
) {
  return prisma.game.update({
    where: { id },
    data,
  });
}

export async function deleteGame(id: string) {
  return prisma.game.delete({
    where: { id },
  });
}
