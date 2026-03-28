import { fetchDeckById } from "@/app/actions"
import DeckCreateCardPageForm from "@/components/editor/deck/DeckCreateCardPageForm"

export default async function NewDeckCardPage({
  params,
}: {
  params: Promise<{ gameId: string; deckId: string }>
}) {
  const { gameId, deckId } = await params
  const deck = await fetchDeckById(deckId)

  if (!deck || deck.gameId !== gameId) {
    return <div className="p-8">Deck no encontrado</div>
  }

  return <DeckCreateCardPageForm gameId={gameId} deckId={deckId} />
}
