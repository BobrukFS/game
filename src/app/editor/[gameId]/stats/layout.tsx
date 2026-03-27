import { ReactNode } from "react"

interface StatsLayoutProps {
  children: ReactNode
  params: { gameId: string }
}

export default function StatsLayout({ children, params }: StatsLayoutProps) {
  return (
    <div className="flex-1">
      <div className="border-b border-slate-700 px-8 py-4">
        <p className="text-sm text-slate-400">
          <a href={`/editor`} className="hover:text-slate-200">Juegos</a>
          {" / "}
          <a href={`/editor/${params.gameId}`} className="hover:text-slate-200">Decks</a>
          {" / "}
          <span className="text-slate-100">Variables</span>
        </p>
      </div>
      {children}
    </div>
  )
}
