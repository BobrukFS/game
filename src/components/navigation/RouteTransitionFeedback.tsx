"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

export default function RouteTransitionFeedback() {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const settleTimeoutRef = useRef<number | null>(null)
  const failSafeTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    function clearTimers() {
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current)
        settleTimeoutRef.current = null
      }

      if (failSafeTimeoutRef.current !== null) {
        window.clearTimeout(failSafeTimeoutRef.current)
        failSafeTimeoutRef.current = null
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const link = target?.closest("a[href]") as HTMLAnchorElement | null
      if (!link) return
      if (link.target === "_blank" || link.hasAttribute("download")) return

      const href = link.getAttribute("href")
      if (!href || href.startsWith("#")) return

      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return

      const current = `${window.location.pathname}${window.location.search}`
      const next = `${url.pathname}${url.search}`
      if (current === next) return

      setIsNavigating(true)
      clearTimers()
      failSafeTimeoutRef.current = window.setTimeout(() => {
        setIsNavigating(false)
      }, 8000)
    }

    document.addEventListener("click", handleDocumentClick, true)

    return () => {
      document.removeEventListener("click", handleDocumentClick, true)
      clearTimers()
    }
  }, [])

  useEffect(() => {
    if (!isNavigating) return

    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current)
    }

    settleTimeoutRef.current = window.setTimeout(() => {
      setIsNavigating(false)
      settleTimeoutRef.current = null
    }, 220)
  }, [pathname, isNavigating])

  useEffect(() => {
    document.body.classList.toggle("route-pending", isNavigating)

    return () => {
      document.body.classList.remove("route-pending")
    }
  }, [isNavigating])

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-[120] h-0.5 transition-opacity duration-150 ${
          isNavigating ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="route-progress-bar h-full w-full" />
      </div>

      <div aria-live="polite" className="sr-only">
        {isNavigating ? "Cambiando de pagina" : "Pagina cargada"}
      </div>

      {isNavigating ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[120] rounded-full border border-cyan-400/40 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-cyan-200 shadow-lg shadow-cyan-900/20 backdrop-blur">
          Cargando pagina...
        </div>
      ) : null}
    </>
  )
}
