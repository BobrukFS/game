import { prisma } from "@/lib/prisma"

export async function getEffectsByOptionId(optionId: string) {
  return prisma.effect.findMany({
    where: { optionId },
    orderBy: { id: "asc" },
  });
}

export async function getFlagKeysByGameId(gameId: string) {
  return prisma.effect.findMany({
    where: {
      type: "set_flag",
      option: {
        card: {
          deck: {
            gameId,
          },
        },
      },
    },
    select: {
      key: true,
    },
    distinct: ["key"],
    orderBy: {
      key: "asc",
    },
  })
}

export async function getOptionGameContext(optionId: string) {
  return prisma.option.findUnique({
    where: { id: optionId },
    select: {
      id: true,
      card: {
        select: {
          deck: {
            select: {
              gameId: true,
            },
          },
        },
      },
    },
  })
}

export async function getEffectGameContext(effectId: string) {
  return prisma.effect.findUnique({
    where: { id: effectId },
    select: {
      id: true,
      type: true,
      key: true,
      option: {
        select: {
          card: {
            select: {
              deck: {
                select: {
                  gameId: true,
                },
              },
            },
          },
        },
      },
    },
  })
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
