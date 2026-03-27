import { prisma } from "@/lib/prisma"

export async function getEffectsByOptionId(optionId: string) {
  return prisma.effect.findMany({
    where: { optionId },
    orderBy: { id: "asc" },
  });
}

export async function createEffect(data: {
  optionId: string;
  type: string;
  key: string;
  value: string;
}) {
  return prisma.effect.create({
    data,
  });
}

export async function updateEffect(
  id: string,
  data: Partial<{ type: string; key: string; value: string }>
) {
  return prisma.effect.update({
    where: { id },
    data,
  });
}

export async function deleteEffect(id: string) {
  return prisma.effect.delete({
    where: { id },
  });
}
