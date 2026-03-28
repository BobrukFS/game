"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export default function DeckSidebar({
  gameName,
  deckName,
  backHref,
  cardsHref,
  settingsHref,
}: {
  gameName: string
  deckName: string
  backHref: string
  cardsHref: string
  settingsHref: string
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem("deck-sidebar-collapsed")
    if (stored === "1") {
      setCollapsed(true)
    }
  }, [])

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem("deck-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-64"} border-r border-slate-700 bg-slate-800 p-3 overflow-auto transition-all duration-200`}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        className="mb-3 w-full rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
      >
        {collapsed ? ">" : "<"}
      </button>

      <Link href={backHref} className="mb-4 block text-sm text-slate-300 hover:text-white">
        {collapsed ? "←" : "← Volver a Decks"}
      </Link>

      {!collapsed && (
        <>
          <h3 className="mb-1 text-xs text-slate-500">Juego</h3>
          <p className="mb-4 font-semibold">{gameName}</p>
          <h3 className="mb-1 text-xs text-slate-500">Deck</h3>
          <h2 className="mb-4 text-xl font-bold">{deckName}</h2>
        </>
      )}

      <nav className="space-y-1 text-sm">
        <Link
          href={cardsHref}
          className={`block rounded px-4 py-2 ${
            pathname === cardsHref ? "bg-slate-700 text-white" : "hover:bg-slate-700"
          }`}
          title="Cartas"
        >
          {collapsed ? "C" : "Cartas"}
        </Link>
        <Link
          href={settingsHref}
          className={`block rounded px-4 py-2 ${
            pathname === settingsHref ? "bg-slate-700 text-white" : "hover:bg-slate-700"
          }`}
          title="Configuracion"
        >
          {collapsed ? "S" : "Configuracion"}
        </Link>
      </nav>
    </aside>
  )
}
