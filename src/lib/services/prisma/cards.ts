import { prisma } from "@/lib/prisma"

export interface CardWithRelations {
  id: string
  deckId: string
  title: string
  type: string
  description: string
  priority: number
  tags: string[]
  createdAt: Date
  conditions: {
    id: string
    cardId: string
    type: string
    key: string
    value: string
  }[]
  options: {
    id: string
    cardId: string
    text: string
    order: number
    nextCardId: string | null
  }[]
}

export async function getCardsByDeckId(deckId: string) {
  return prisma.card.findMany({
    where: { deckId },
    include: {
      options: {
        select: {
          id: true,
          cardId: true,
          text: true,
          order: true,
          nextCardId: true,
        },
        orderBy: {
          order: "asc",
        },
      },
      conditions: {
        select: {
          id: true,
          cardId: true,
          type: true,
          key: true,
          value: true,
        },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

export async function getCardById(id: string): Promise<CardWithRelations | null> {
  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      conditions: true,
      options: {
        include: {
          effects: true,
        },
      },
    },
  });

  if (!card) return null;

  return {
    ...card,
    conditions: card.conditions,
    options: card.options,
  };
}

export async function createCard(data: {
  deckId: string;
  title: string;
  type: string;
  description?: string;
  priority?: number;
  tags?: string[];
}) {
  return prisma.card.create({
    data: {
      deckId: data.deckId,
      title: data.title,
      type: data.type,
      description: data.description || "",
      priority: data.priority || 0,
      tags: data.tags || [],
    },
  });
}

export async function updateCard(
  id: string,
  data: Partial<{
    title: string;
    type: string;
    description: string;
    priority: number;
    tags: string[];
  }>
) {
  return prisma.card.update({
    where: { id },
    data,
  });
}

export async function deleteCard(id: string) {
  return prisma.card.delete({
    where: { id },
  });
}
