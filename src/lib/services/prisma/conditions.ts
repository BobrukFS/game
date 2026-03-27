import { prisma } from "@/lib/prisma"

export async function getConditionsByCardId(cardId: string) {
  return prisma.condition.findMany({
    where: { cardId },
    orderBy: { id: "asc" },
  });
}

export async function createCondition(data: {
  cardId: string;
  type: string;
  key: string;
  value: string;
}) {
  return prisma.condition.create({
    data,
  });
}

export async function updateCondition(
  id: string,
  data: Partial<{ type: string; key: string; value: string }>
) {
  return prisma.condition.update({
    where: { id },
    data,
  });
}

export async function deleteCondition(id: string) {
  return prisma.condition.delete({
    where: { id },
  });
}
