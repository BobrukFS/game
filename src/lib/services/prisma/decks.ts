import { prisma } from "@/lib/prisma"

export interface OptionWithEffects {
  id: string
  cardId: string
  text: string
  order: number
  nextCardId: string | null
  effects: any[]
}

export async function getAllDecks() {
  return prisma.deck.findMany({
    include: {
      _count: {
        select: { cards: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getDecksByGameId(gameId: string) {
  return prisma.deck.findMany({
    where: { gameId },
    include: {
      _count: {
        select: { cards: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getDeckById(id: string) {
  return prisma.deck.findUnique({
    where: { id },
  });
}

export async function createDeck(data: {
  gameId: string;
  name: string;
  type: string;
  weight: number;
  description?: string;
}) {
  return prisma.deck.create({
    data: {
      gameId: data.gameId,
      name: data.name,
      type: data.type,
      weight: data.weight,
      description: data.description || "",
    },
  });
}

export async function updateDeck(
  id: string,
  data: Partial<{ name: string; type: string; weight: number; description: string }>
) {
  return prisma.deck.update({
    where: { id },
    data,
  });
}

export async function deleteDeck(id: string) {
  return prisma.deck.delete({
    where: { id },
  });
}
