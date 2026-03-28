"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavLinkItem {
  href: string
  label: string
}

function NavChip({ href, label, active }: NavLinkItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
      }`}
    >
      {label}
    </Link>
  )
}

export default function AppTopNav() {
  const pathname = usePathname()

  const editorLinks: NavLinkItem[] = [{ href: "/editor", label: "Editor" }]
  const runtimeLinks: NavLinkItem[] = [
    { href: "/play", label: "Play" },
    { href: "/test", label: "Debug" },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Editor</p>
          <div className="flex flex-wrap gap-2">
            {editorLinks.map((item) => (
              <NavChip key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-amber-50 p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Runtime</p>
          <div className="flex flex-wrap gap-2">
            {runtimeLinks.map((item) => (
              <NavChip key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </div>
        </section>
      </div>
    </nav>
  )
}
