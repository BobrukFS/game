import { fetchGameById } from "@/app/actions"
import DeleteGameCard from "@/components/editor/DeleteGameCard"

export default async function GameSettingsPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = await params
  const game = await fetchGameById(gameId)

  if (!game) {
    return <div className="p-8">Juego no encontrado</div>
  }

  return (
    <div className="min-h-full bg-slate-900 p-8 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-slate-700 pb-4">
          <h1 className="text-2xl font-semibold">Configuracion</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ajustes del juego con estilo limpio inspirado en GitHub.
          </p>
        </header>

        <section className="rounded-lg border border-slate-700 bg-slate-800/70">
          <div className="border-b border-slate-700 px-5 py-3">
            <h2 className="text-sm font-semibold">General</h2>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div>
              <label htmlFor="game-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nombre
              </label>
              <input
                id="game-name"
                value={game.name}
                disabled
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
            </div>

            <div>
              <label htmlFor="game-description" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Descripcion
              </label>
              <textarea
                id="game-description"
                value={game.description || "Sin descripcion"}
                disabled
                rows={4}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
            </div>
          </div>
        </section>

        <DeleteGameCard gameId={gameId} />
      </div>
    </div>
  )
}
