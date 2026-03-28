import { ReactNode } from "react"
import { fetchGameById, fetchDeckById } from "@/app/actions"
import DeckSidebar from "@/components/editor/DeckSidebar"

export default async function DeckLayout({
  children,
  params
}: {
  children: ReactNode
  params: Promise<{ gameId: string; deckId: string }>
}) {
  const { gameId, deckId } = await params
  const [game, deck] = await Promise.all([
    fetchGameById(gameId),
    fetchDeckById(deckId)
  ])

  if (!deck || !game) {
    return <div className="p-8">Deck no encontrado</div>
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <DeckSidebar
        gameName={game.name}
        deckName={deck.name}
        backHref={`/editor/${gameId}`}
        cardsHref={`/editor/${gameId}/decks/${deckId}`}
        settingsHref={`/editor/${gameId}/decks/${deckId}/settings`}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
