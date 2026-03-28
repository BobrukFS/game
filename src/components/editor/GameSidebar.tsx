"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

type NavItem = {
  label: string
  href: string
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
        className="mb-3 w-full rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
      >
        {collapsed ? ">" : "<"}
      </button>

      <Link href={backHref} className="mb-4 block text-sm text-slate-300 hover:text-white">
        {collapsed ? "←" : "← Volver a Juegos"}
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
              className={`block rounded-md px-3 py-2 transition-colors ${
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-200 hover:bg-slate-700/80 hover:text-white"
              }`}
            >
              {collapsed ? item.label.slice(0, 1) : item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
