import { ReactNode } from "react"
import Link from "next/link"
import { fetchCardById, fetchGameById } from "@/app/actions"

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
      <aside className="w-64 border-r border-slate-700 bg-slate-800 p-4 overflow-auto">
        <Link href={`/editor/${gameId}`} className="text-blue-400 hover:text-blue-300 text-sm mb-4 block">
          ← Volver
        </Link>
        <h3 className="text-xs text-slate-500 mb-1">Juego</h3>
        <p className="font-semibold mb-4">{game.name}</p>
        <h3 className="text-xs text-slate-500 mb-1">Carta</h3>
        <h2 className="text-lg font-bold mb-4">{card.title}</h2>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
