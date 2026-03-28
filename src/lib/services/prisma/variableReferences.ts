import { prisma } from "@/lib/prisma"

export type VariableReferenceType = "stat" | "world_state" | "flag"

type CardRef = {
  id: string
  title: string
  deck: {
    id: string
    name: string
  }
}

function getEffectTypes(type: VariableReferenceType): string[] {
  if (type === "stat") return ["modify_stat", "set_stat"]
  if (type === "world_state") return ["set_world_state", "modify_world_state"]
  return ["set_flag", "remove_flag"]
}

export async function getVariableReferences(gameId: string, type: VariableReferenceType, key: string) {
  const cards = await prisma.card.findMany({
    where: {
      deck: { gameId },
      OR: [
        {
          conditions: {
            some: {
              dataType: type,
              key,
            },
          },
        },
        {
          options: {
            some: {
              effects: {
                some: {
                  key,
                  type: {
                    in: getEffectTypes(type),
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      title: true,
      deck: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      title: "asc",
    },
  })

  const uniqueDeckMap = new Map<string, { id: string; name: string }>()
  for (const card of cards as CardRef[]) {
    uniqueDeckMap.set(card.deck.id, { id: card.deck.id, name: card.deck.name })
  }

  return {
    cards,
    decks: Array.from(uniqueDeckMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  }
}
