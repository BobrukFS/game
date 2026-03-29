import { ReactNode } from "react"
import EditorSidebar from "@/components/editor/EditorSidebar"
import { fetchGames } from "@/app/actions"

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const games = await fetchGames()

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <EditorSidebar initialGames={games} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
