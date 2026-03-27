import { prisma } from "@/lib/prisma"

export interface OptionWithEffects {
  id: string
  cardId: string
  text: string
  order: number
  nextCardId: string | null
  effects: any[]
}

export async function getOptionsByCardId(cardId: string) {
  return prisma.option.findMany({
    where: { cardId },
    include: { effects: true },
    orderBy: { order: "asc" },
  });
}

export async function getOptionById(id: string): Promise<OptionWithEffects | null> {
  return prisma.option.findUnique({
    where: { id },
    include: { effects: true },
  });
}

export async function createOption(data: {
  cardId: string;
  text: string;
  order?: number;
  nextCardId?: string;
}) {
  return prisma.option.create({
    data: {
      cardId: data.cardId,
      text: data.text,
      order: data.order || 1,
      nextCardId: data.nextCardId || null,
    },
  });
}

export async function updateOption(
  id: string,
  data: Partial<{ text: string; order: number; nextCardId?: string | null }>
) {
  return prisma.option.update({
    where: { id },
    data,
  });
}

export async function deleteOption(id: string) {
  return prisma.option.delete({
    where: { id },
  });
}
