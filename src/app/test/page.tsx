import Link from "next/link"
import { getAllGames } from "@/lib/services/prisma/games"

export default async function TestIndexPage() {
  const games = await getAllGames()

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Test</h1>
        <p className="text-sm text-gray-600">Modo de prueba con debug y opcion de volver atras.</p>
      </header>

      {games.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center text-sm text-gray-500">
          No hay juegos disponibles.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/test/${game.id}`}
              className="rounded border bg-white p-4 hover:border-amber-300 hover:bg-amber-50"
            >
              <div className="text-sm font-semibold text-gray-900">{game.name}</div>
              <div className="mt-1 text-xs text-gray-600 line-clamp-2">{game.description || "Sin descripcion"}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
