import { fetchDecksByGameId } from "@/app/actions"
import GameDecksPageClient from "@/components/editor/GameDecksPageClient"

type DeckListItem = {
  id: string
  gameId: string
  name: string
  type: string
  weight: number
  description: string
  repeatable?: boolean
  _count?: {
    cards: number
  }
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  let decks: DeckListItem[] = []

  try {
    decks = (await fetchDecksByGameId(gameId)) as DeckListItem[]
  } catch (error) {
    console.error("Error loading decks in game page:", error)
  }

  return <GameDecksPageClient gameId={gameId} initialDecks={decks} />
}
