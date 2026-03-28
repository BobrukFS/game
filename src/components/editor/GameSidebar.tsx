"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

type NavItem = {
  label: string
  href: string
}

function NavIcon({ label }: { label: string }) {
  if (label.toLowerCase().includes("deck")) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="4" rx="1" />
        <rect x="4" y="11" width="16" height="4" rx="1" />
        <rect x="4" y="17" width="16" height="2" rx="1" />
      </svg>
    )
  }

  if (label.toLowerCase().includes("variable")) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 8h12" />
        <path d="M6 12h8" />
        <path d="M6 16h5" />
      </svg>
    )
  }

  if (label.toLowerCase().includes("logic")) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M8 6h8" />
        <path d="M7 8l4 8" />
        <path d="M17 8l-4 8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}

export default function GameSidebar({
  gameName,
  backHref,
  navItems,
}: {
  gameName: string
  backHref: string
  navItems: NavItem[]
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem("game-sidebar-collapsed")
    if (stored === "1") {
      setCollapsed(true)
    }
  }, [])

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem("game-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-72"} border-r border-slate-700 bg-slate-800 p-3 overflow-auto transition-all duration-200`}
    >
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
        href={backHref}
        className="mb-4 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m15 6-6 6 6 6" />
        </svg>
        {!collapsed && "Volver a Juegos"}
      </Link>

      {!collapsed && <h2 className="mb-3 text-xl font-semibold">{gameName}</h2>}

      <nav className="space-y-1 rounded-md border border-slate-700 bg-slate-800/70 p-2 text-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-200 hover:bg-slate-700/80 hover:text-white"
              }`}
            >
              <NavIcon label={item.label} />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
