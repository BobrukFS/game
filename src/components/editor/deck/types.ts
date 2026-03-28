import { CardWithRelations } from "@/lib/services/prisma/cards"

export type DeckCardType = "decision" | "narrative" | "interactive"

export type DeckModel = {
  id: string
  gameId: string
  name: string
  type: string
  weight: number
  description: string
}

export type DeckCard = CardWithRelations
