import { fetchCardById } from "@/app/actions"
import DeleteCardCard from "@/components/editor/DeleteCardCard"
import PathTrail from "@/components/editor/PathTrail"

export default async function CardSettingsPage({
  params,
}: {
  params: Promise<{ gameId: string; cardId: string }>
}) {
  const { gameId, cardId } = await params
  const card = await fetchCardById(cardId)

  if (!card) {
    return <div className="p-8">Carta no encontrada</div>
  }

  return (
    <div className="min-h-full bg-slate-900 p-8 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-slate-700 pb-4">
          <PathTrail
            items={[
              { label: "Editor", href: "/editor" },
              { label: "Decks", href: `/editor/${gameId}` },
              { label: "Cartas", href: `/editor/${gameId}/decks/${card.deckId}` },
              { label: card.title, href: `/editor/${gameId}/cards/${card.id}` },
              { label: "Configuracion" },
            ]}
            maxVisible={5}
          />
          <h1 className="text-2xl font-semibold">Configuracion</h1>
          <p className="mt-1 text-sm text-slate-400">Ajustes de la carta.</p>
        </header>

        <section className="rounded-lg border border-slate-700 bg-slate-800/70">
          <div className="border-b border-slate-700 px-5 py-3">
            <h2 className="text-sm font-semibold">General</h2>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div>
              <label htmlFor="card-title" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Titulo
              </label>
              <input
                id="card-title"
                value={card.title}
                disabled
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
            </div>

            <div>
              <label htmlFor="card-type" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tipo
              </label>
              <input
                id="card-type"
                value={card.type}
                disabled
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
            </div>
          </div>
        </section>

        <DeleteCardCard gameId={gameId} deckId={card.deckId} cardId={card.id} />
      </div>
    </div>
  )
}
