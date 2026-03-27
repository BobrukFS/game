"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { fetchGames } from "@/app/actions"
import { Game } from "@/lib/domain"

export default function EditorSidebar() {
  const pathname = usePathname()
  const [games, setGames] = useState<Game[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadGames() {
      try {
        setIsLoading(true)
        const data = await fetchGames()
        if (mounted) {
          setGames(data)
        }
      } catch (error) {
        console.error("Error loading games for sidebar:", error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadGames()

    const refreshHandler = () => {
      loadGames()
    }

    window.addEventListener("games:refresh", refreshHandler)

    return () => {
      mounted = false
      window.removeEventListener("games:refresh", refreshHandler)
    }
  }, [])

  const selectedGameId = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean)
    if (parts.length >= 2 && parts[0] === "editor") {
      return parts[1]
    }
    return null
  }, [pathname])

  return (
    <aside className="w-64 border-r border-slate-700 bg-slate-800 p-4 overflow-auto">
      <h1 className="mb-6 text-2xl font-bold">Reigns Editor</h1>

      <nav className="space-y-2">
        <Link
          href="/editor"
          className={`block rounded px-4 py-2 transition-colors ${
            pathname === "/editor" ? "bg-slate-700 text-white" : "hover:bg-slate-700"
          }`}
        >
          Games
        </Link>
      </nav>

      <div className="mt-6">
        <p className="mb-2 px-1 text-xs uppercase tracking-wide text-slate-400">Listado</p>
        {isLoading && <p className="px-1 text-sm text-slate-400">Cargando...</p>}

        {!isLoading && games.length === 0 && (
          <p className="px-1 text-sm text-slate-400">No hay games</p>
        )}

        <ul className="space-y-1">
          {games.map((game) => {
            const isActive = selectedGameId === game.id
            return (
              <li key={game.id}>
                <Link
                  href={`/editor/${game.id}`}
                  className={`block rounded px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-blue-600/30 text-blue-200 ring-1 ring-blue-500/50"
                      : "text-slate-200 hover:bg-slate-700"
                  }`}
                  title={game.name}
                >
                  <span className="block truncate">{game.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}