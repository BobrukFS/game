"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

type PathItem = {
  label: string
  href?: string
}

export default function PathTrail({
  items,
  maxVisible = 4,
}: {
  items: PathItem[]
  maxVisible?: number
}) {
  const [expanded, setExpanded] = useState(false)

  const visibleItems = useMemo(() => {
    if (expanded || items.length <= maxVisible) {
      return items
    }

    const tailCount = Math.max(maxVisible - 2, 1)
    return [items[0], { label: "..." }, ...items.slice(-tailCount)]
  }, [expanded, items, maxVisible])

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 text-xs uppercase tracking-wide text-slate-400">
      {visibleItems.map((item, index) => {
        const isLast = index === visibleItems.length - 1
        const showSlash = !isLast

        if (item.label === "...") {
          return (
            <div key={`ellipsis-${index}`} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="rounded px-1 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white"
                title="Mostrar ruta completa"
              >
                ...
              </button>
              {showSlash && <span className="text-slate-500">/</span>}
            </div>
          )
        }

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.href ? (
              <Link href={item.href} className="rounded px-1 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className="px-1 py-0.5 text-slate-200">{item.label}</span>
            )}
            {showSlash && <span className="text-slate-500">/</span>}
          </div>
        )
      })}
    </div>
  )
}
