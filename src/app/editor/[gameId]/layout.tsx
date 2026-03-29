import { ReactNode } from "react"
import { fetchGameById } from "@/app/actions"
import GameSidebar from "@/components/editor/GameSidebar"

export default async function GameLayout({
  children,
  params
}: {
  children: ReactNode
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  let game = null

  try {
    game = await fetchGameById(gameId)
  } catch (error) {
    console.error("Error loading game in game layout:", error)
  }

  if (!game) {
    return <div className="p-8">Juego no encontrado</div>
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <GameSidebar
        gameName={game.name}
        backHref="/editor"
        navItems={[
          { label: "Decks", href: `/editor/${gameId}` },
          { label: "Narrative", href: `/editor/${gameId}/narrative` },
          { label: "Variables", href: `/editor/${gameId}/stats` },
          { label: "Game Logic", href: `/editor/${gameId}/logic` },
          { label: "Configuracion", href: `/editor/${gameId}/settings` },
        ]}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
