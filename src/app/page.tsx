
import Link from "next/link"
import AppTopNav from "@/components/navigation/AppTopNav"

export default async function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Reigns</h1>
        <p className="text-sm text-slate-600">
          Elige rapidamente entre edicion de contenido y ejecucion del runtime.
        </p>
      </header>

      <AppTopNav />

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/editor"
          className="rounded-xl border border-slate-300 bg-slate-900 p-5 text-slate-100 transition-colors hover:bg-slate-800"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Editor</p>
          <h2 className="mt-2 text-xl font-bold">Construir contenido</h2>
          <p className="mt-2 text-sm text-slate-300">Crea juegos, decks, cartas y reglas de logica.</p>
        </Link>

        <div className="grid gap-4">
          <Link
            href="/play"
            className="rounded-xl border border-cyan-200 bg-cyan-50 p-5 transition-colors hover:bg-cyan-100"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Runtime</p>
            <h2 className="mt-2 text-lg font-bold text-cyan-900">Play</h2>
            <p className="mt-1 text-sm text-cyan-900/80">Sesion normal del juego para jugador final.</p>
          </Link>

          <Link
            href="/test"
            className="rounded-xl border border-amber-300 bg-amber-50 p-5 transition-colors hover:bg-amber-100"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Runtime</p>
            <h2 className="mt-2 text-lg font-bold text-amber-900">Debug</h2>
            <p className="mt-1 text-sm text-amber-900/80">Simulador completo, snapshots y herramientas de inspeccion.</p>
          </Link>
        </div>
      </section>
    </main>
  )
}