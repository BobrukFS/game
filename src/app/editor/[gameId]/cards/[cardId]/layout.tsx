import { ReactNode } from "react"
import { fetchCardById, fetchGameById } from "@/app/actions"
import CardSidebar from "@/components/editor/CardSidebar"

export default async function CardLayout({
  children,
  params
}: {
  children: ReactNode
  params: Promise<{ gameId: string; cardId: string }>
}) {
  const { gameId, cardId } = await params
  const [game, card] = await Promise.all([
    fetchGameById(gameId),
    fetchCardById(cardId)
  ])

  if (!card || !game) {
    return <div className="p-8">Carta no encontrada</div>
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <CardSidebar gameId={gameId} cardId={cardId} gameName={game.name} cardTitle={card.title} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
