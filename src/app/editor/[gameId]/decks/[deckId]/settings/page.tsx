import { fetchDeckById } from "@/app/actions"
import DeleteDeckCard from "@/components/editor/DeleteDeckCard"
import DeckGeneralSettingsForm from "@/components/editor/deck/DeckGeneralSettingsForm"
import PathTrail from "@/components/editor/PathTrail"

export default async function DeckSettingsPage({
  params,
}: {
  params: Promise<{ gameId: string; deckId: string }>
}) {
  const { gameId, deckId } = await params
  const deck = await fetchDeckById(deckId)

  if (!deck || deck.gameId !== gameId) {
    return <div className="p-8">Deck no encontrado</div>
  }

  return (
    <div className="min-h-full bg-slate-900 p-8 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-slate-700 pb-4">
          <PathTrail
            items={[
              { label: "Editor", href: "/editor" },
              { label: "Decks", href: `/editor/${gameId}` },
              { label: "Configuracion" },
            ]}
          />
          <h1 className="text-2xl font-semibold">Configuracion</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ajustes del deck con estilo limpio inspirado en GitHub.
          </p>
        </header>

        <DeckGeneralSettingsForm
          deck={{
            id: deck.id,
            gameId: deck.gameId,
            name: deck.name,
            type: deck.type,
            weight: deck.weight,
            description: deck.description || "",
            repeatable: deck.repeatable ?? true,
          }}
        />

        <DeleteDeckCard gameId={gameId} deckId={deckId} />
      </div>
    </div>
  )
}
