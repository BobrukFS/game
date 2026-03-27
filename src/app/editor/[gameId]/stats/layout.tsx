import { ReactNode } from "react"

interface StatsLayoutProps {
  children: ReactNode
  params: Promise<{ gameId: string }>
}

export default async function StatsLayout({ children, params }: StatsLayoutProps) {
  const { gameId } = await params

  return (
    <div className="flex-1">
      <div className="border-b border-slate-700 px-8 py-4">
        <p className="text-sm text-slate-400">
          <a href={`/editor`} className="hover:text-slate-200">Juegos</a>
          {" / "}
          <a href={`/editor/${gameId}`} className="hover:text-slate-200">Decks</a>
          {" / "}
          <span className="text-slate-100">Variables</span>
        </p>
      </div>
      {children}
    </div>
  )
}
