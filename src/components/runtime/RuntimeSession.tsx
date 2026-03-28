"use client"

import { useMemo, useState } from "react"
import {
  CardDebugEntry,
  applySelectedOption,
  buildInitialGameState,
  drawNextCard,
} from "@/lib/play/runtime"
import { PlayRuntimeBundle } from "@/lib/services/prisma/playRuntime"
import { GameState } from "@/lib/domain"

interface RuntimeSnapshot {
  state: GameState
  currentCardId: string | null
}

interface RuntimeSessionProps {
  bundle: PlayRuntimeBundle
  mode: "play" | "test"
}

function toPrettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function StatLine({ label, value }: { label: string; value: number }) {
  const tone = value > 0 ? "text-green-700" : value < 0 ? "text-red-700" : "text-gray-700"
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2 text-sm">
      <span className="font-medium text-gray-600">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

function DebugConditions({ entries }: { entries: CardDebugEntry[] }) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.cardId} className="rounded border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">{entry.title}</h4>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                entry.valid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
              }`}
            >
              {entry.valid ? "Valida" : "Bloqueada"}
            </span>
          </div>
          {entry.evaluations.length === 0 ? (
            <p className="text-xs text-gray-500">Sin condiciones.</p>
          ) : (
            <div className="space-y-1">
              {entry.evaluations.map((evaluation, index) => (
                <div key={`${entry.cardId}-${index}`} className="text-xs text-gray-700">
                  {evaluation.type} · {evaluation.key} · esperado: {evaluation.expected} · actual: {evaluation.actual}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function RuntimeSession({ bundle, mode }: RuntimeSessionProps) {
  const initialRuntime = useMemo(() => {
    const initialState = buildInitialGameState(bundle)
    const firstCardResult = drawNextCard(bundle, initialState)

    return {
      state: firstCardResult.state,
      currentCardId: firstCardResult.card?.id || null,
      debugEntries: firstCardResult.debug,
      message: firstCardResult.message || (firstCardResult.card ? "Carta inicial seleccionada." : "Sin carta disponible."),
    }
  }, [bundle])

  const [state, setState] = useState<GameState>(() => initialRuntime.state)
  const [currentCardId, setCurrentCardId] = useState<string | null>(() => initialRuntime.currentCardId)
  const [debugEntries, setDebugEntries] = useState<CardDebugEntry[]>(() => initialRuntime.debugEntries)
  const [message, setMessage] = useState<string>(() => initialRuntime.message)
  const [timeline, setTimeline] = useState<RuntimeSnapshot[]>([])

  const currentCard = useMemo(
    () => bundle.cards.find((card) => card.id === currentCardId) || null,
    [bundle.cards, currentCardId]
  )

  const onChooseOption = (optionId: string) => {
    if (!currentCard) return

    const optionResult = applySelectedOption(bundle, state, currentCard.id, optionId)
    const nextCardResult = drawNextCard(bundle, optionResult.state)

    setTimeline((prev) => [...prev, { state, currentCardId }])
    setState(nextCardResult.state)
    setCurrentCardId(nextCardResult.card?.id || null)
    setDebugEntries(nextCardResult.debug)
    setMessage(
      optionResult.message ||
        nextCardResult.message ||
        (nextCardResult.card ? "Opcion aplicada y siguiente carta seleccionada por peso." : "Opcion aplicada.")
    )
  }

  const onBack = () => {
    if (mode !== "test") return
    if (timeline.length === 0) return

    const previous = timeline[timeline.length - 1]
    setTimeline((prev) => prev.slice(0, -1))
    setState(previous.state)
    setCurrentCardId(previous.currentCardId)
    setMessage("Se revirtio el ultimo paso.")
  }

  const reset = () => {
    const nextInitialState = buildInitialGameState(bundle)
    const nextFirstCardResult = drawNextCard(bundle, nextInitialState)

    setState(nextFirstCardResult.state)
    setCurrentCardId(nextFirstCardResult.card?.id || null)
    setDebugEntries(nextFirstCardResult.debug)
    setTimeline([])
    setMessage(nextFirstCardResult.message || "Sesion reiniciada.")
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4 rounded border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">{bundle.game.name}</h2>
          <div className="flex gap-2">
            {mode === "test" && (
              <button
                onClick={onBack}
                className="rounded border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Volver atras
              </button>
            )}
            <button
              onClick={reset}
              className="rounded border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Reiniciar
            </button>
          </div>
        </div>

        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</p>

        {currentCard ? (
          <article className="space-y-4 rounded border p-4">
            <header>
              <h3 className="text-xl font-bold text-gray-900">{currentCard.title}</h3>
              <p className="mt-1 text-sm text-gray-700">{currentCard.description}</p>
            </header>

            {currentCard.options.length > 0 ? (
              <div className="space-y-2">
                {currentCard.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onChooseOption(option.id)}
                    className="block w-full rounded border px-3 py-2 text-left text-sm font-medium hover:bg-gray-50"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">Esta carta no tiene opciones.</p>
            )}
          </article>
        ) : (
          <div className="rounded border border-dashed p-6 text-center text-sm text-gray-500">
            No hay carta activa para el estado actual.
          </div>
        )}

        {mode === "test" && (
          <div className="rounded border bg-gray-50 p-3 text-xs text-gray-700">
            <div>Historial de pasos: {timeline.length}</div>
            <div>Interacciones: {state.interactions?.total || 0}</div>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Stats</h3>
          <div className="space-y-2">
            {Object.entries(state.stats).length === 0 ? (
              <p className="text-xs text-gray-500">Sin stats.</p>
            ) : (
              Object.entries(state.stats).map(([key, value]) => <StatLine key={key} label={key} value={Number(value)} />)
            )}
          </div>
        </section>

        <section className="rounded border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">World</h3>
          <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
            {toPrettyJson(state.world)}
          </pre>
        </section>

        {mode === "test" && (
          <section className="rounded border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Debug de condiciones</h3>
            <DebugConditions entries={debugEntries} />
          </section>
        )}
      </aside>
    </div>
  )
}
