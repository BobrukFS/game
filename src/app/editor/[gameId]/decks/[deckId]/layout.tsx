import { ReactNode } from "react"
import Link from "next/link"
import { fetchGameById, fetchDeckById } from "@/app/actions"

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
      <aside className="w-64 border-r border-slate-700 bg-slate-800 p-4 overflow-auto">
        <Link href={`/editor/${gameId}`} className="text-blue-400 hover:text-blue-300 text-sm mb-4 block">
          ← Volver a Decks
        </Link>
        <h3 className="text-xs text-slate-500 mb-1">Juego</h3>
        <p className="font-semibold mb-4">{game.name}</p>
        <h3 className="text-xs text-slate-500 mb-1">Deck</h3>
        <h2 className="text-xl font-bold mb-4">{deck.name}</h2>
        <nav className="space-y-2 text-sm">
          <Link
            href={`/editor/${gameId}/decks/${deckId}`}
            className="block px-4 py-2 rounded hover:bg-slate-700"
          >
            Cartas
          </Link>
          <Link
            href={`/editor/${gameId}/decks/${deckId}/settings`}
            className="block px-4 py-2 rounded hover:bg-slate-700"
          >
            Configuración
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
