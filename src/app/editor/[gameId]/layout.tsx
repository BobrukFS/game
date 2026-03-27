import { ReactNode } from "react"
import Link from "next/link"
import { fetchGameById } from "@/app/actions"

export default async function GameLayout({
  children,
  params
}: {
  children: ReactNode
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const game = await fetchGameById(gameId)

  if (!game) {
    return <div className="p-8">Juego no encontrado</div>
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <aside className="w-64 border-r border-slate-700 bg-slate-800 p-4 overflow-auto">
        <Link href="/editor" className="text-blue-400 hover:text-blue-300 text-sm mb-4 block">
          ← Volver a Juegos
        </Link>
        <h2 className="text-xl font-bold mb-4">{game.name}</h2>
        <nav className="space-y-2 text-sm">
          <Link href={`/editor/${gameId}`} className="block px-4 py-2 rounded hover:bg-slate-700">
            Decks
          </Link>
          <Link
            href={`/editor/${gameId}/stats`}
            className="block px-4 py-2 rounded hover:bg-slate-700"
          >
            Variables
          </Link>
          <Link
            href={`/editor/${gameId}/logic`}
            className="block px-4 py-2 rounded hover:bg-slate-700"
          >
            Game Logic
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
