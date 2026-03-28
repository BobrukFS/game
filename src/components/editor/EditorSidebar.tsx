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
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem("editor-sidebar-collapsed")
    if (stored === "1") {
      setCollapsed(true)
    }

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

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem("editor-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }

  const selectedGameId = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean)
    if (parts.length >= 2 && parts[0] === "editor") {
      return parts[1]
    }
    return null
  }, [pathname])

  return (
    <aside className={`${collapsed ? "w-16" : "w-64"} border-r border-slate-700 bg-slate-800 p-3 overflow-auto transition-all duration-200`}>
      <button
        type="button"
        onClick={toggleSidebar}
        className="mb-3 flex w-full items-center justify-center rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
      >
        {collapsed ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 6 6 6-6 6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 6-6 6 6 6" />
          </svg>
        )}
      </button>

      {!collapsed && <h1 className="mb-6 text-2xl font-bold">Reigns Editor</h1>}

      <nav className="space-y-2">
        <Link
          href="/editor"
          title="Games"
          className={`flex items-center gap-2 rounded px-3 py-2 transition-colors ${
            pathname === "/editor" ? "bg-slate-700 text-white" : "hover:bg-slate-700"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="5" width="16" height="4" rx="1" />
            <rect x="4" y="11" width="16" height="4" rx="1" />
            <rect x="4" y="17" width="16" height="2" rx="1" />
          </svg>
          {!collapsed && "Games"}
        </Link>
      </nav>

      <div className="mt-6">
        {!collapsed && <p className="mb-2 px-1 text-xs uppercase tracking-wide text-slate-400">Listado</p>}
        {isLoading && !collapsed && <p className="px-1 text-sm text-slate-400">Cargando...</p>}

        {!isLoading && games.length === 0 && !collapsed && (
          <p className="px-1 text-sm text-slate-400">No hay games</p>
        )}

        <ul className="space-y-1">
          {games.map((game) => {
            const isActive = selectedGameId === game.id
            return (
              <li key={game.id}>
                <Link
                  href={`/editor/${game.id}`}
                  className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-blue-600/30 text-blue-200 ring-1 ring-blue-500/50"
                      : "text-slate-200 hover:bg-slate-700"
                  }`}
                  title={game.name}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-700 text-[10px] font-semibold uppercase">
                    {game.name.slice(0, 1)}
                  </span>
                  {!collapsed && <span className="block truncate">{game.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}