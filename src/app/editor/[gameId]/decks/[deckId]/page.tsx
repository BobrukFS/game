"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { fetchCardsByDeckId, fetchDeckById } from "@/app/actions"
import DeckCardsSection from "@/components/editor/deck/DeckCardsSection"
import { CardWithRelations } from "@/lib/services/prisma/cards"

export default function DeckPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const deckId = params.deckId as string

  const [cards, setCards] = useState<CardWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDeckPage()
  }, [deckId])

  async function loadDeckPage() {
    try {
      setIsLoading(true)
      const [deckData, cardsData] = await Promise.all([fetchDeckById(deckId), fetchCardsByDeckId(deckId)])

      if (deckData) {
        setCards(cardsData as CardWithRelations[])
      }
    } catch (error) {
      console.error("Error loading deck page:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="p-8">
      <DeckCardsSection
        deckId={deckId}
        gameId={gameId}
        initialCards={cards}
      />
    </div>
  )
}
