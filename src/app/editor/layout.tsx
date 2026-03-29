import { ReactNode } from "react"
import EditorSidebar from "@/components/editor/EditorSidebar"
import { fetchGames } from "@/app/actions"
import { Game } from "@/lib/domain"

export default async function EditorLayout({ children }: { children: ReactNode }) {
  let games: Game[] = []

  try {
    games = await fetchGames()
  } catch (error) {
    console.error("Error loading games in editor layout:", error)
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <EditorSidebar initialGames={games} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
