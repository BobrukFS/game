"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export default function CardSidebar({
  gameId,
  cardId,
  gameName,
  cardTitle,
}: {
  gameId: string
  cardId: string
  gameName: string
  cardTitle: string
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem("card-sidebar-collapsed")
    if (stored === "1") {
      setCollapsed(true)
    }
  }, [])

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem("card-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }

  const cardEditHref = `/editor/${gameId}/cards/${cardId}`
  const cardSettingsHref = `/editor/${gameId}/cards/${cardId}/settings`

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

      <Link
        href={`/editor/${gameId}`}
        className="mb-4 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m15 6-6 6 6 6" />
        </svg>
        {!collapsed && "Volver"}
      </Link>

      {!collapsed && (
        <>
          <h3 className="mb-1 text-xs text-slate-500">Juego</h3>
          <p className="mb-4 font-semibold">{gameName}</p>
          <h3 className="mb-1 text-xs text-slate-500">Carta</h3>
          <h2 className="mb-4 text-lg font-bold truncate" title={cardTitle}>{cardTitle}</h2>
        </>
      )}

      <nav className="space-y-1 text-sm">
        <Link
          href={cardEditHref}
          className={`flex items-center gap-2 rounded px-4 py-2 ${pathname === cardEditHref ? "bg-slate-700 text-white" : "hover:bg-slate-700"}`}
          title="Editar"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20h4l10-10-4-4L4 16v4Z" />
            <path d="m12 6 4 4" />
          </svg>
          {!collapsed && "Editar"}
        </Link>

        <Link
          href={cardSettingsHref}
          className={`flex items-center gap-2 rounded px-4 py-2 ${pathname === cardSettingsHref ? "bg-slate-700 text-white" : "hover:bg-slate-700"}`}
          title="Configuracion"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.08-1l2-1.56-2-3.44-2.4.8a7.2 7.2 0 0 0-1.74-1L14.5 3h-5l-.28 2.8a7.2 7.2 0 0 0-1.74 1l-2.4-.8-2 3.44 2 1.56A7 7 0 0 0 5 12c0 .34.03.67.08 1l-2 1.56 2 3.44 2.4-.8a7.2 7.2 0 0 0 1.74 1L9.5 21h5l.28-2.8a7.2 7.2 0 0 0 1.74-1l2.4.8 2-3.44-2-1.56c.05-.33.08-.66.08-1Z" />
          </svg>
          {!collapsed && "Configuracion"}
        </Link>
      </nav>
    </aside>
  )
}
