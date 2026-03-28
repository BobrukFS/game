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

const SWIPE_THRESHOLD = 84
const PREVIEW_THRESHOLD = 28

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
  const [dragStartX, setDragStartX] = useState<number | null>(null)
  const [dragOffsetX, setDragOffsetX] = useState(0)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)

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

  const onSkipNarrative = (direction: "left" | "right") => {
    if (!currentCard || currentCard.type !== "narrative") return

    const fallbackOption = currentCard.options[0]
    if (fallbackOption) {
      onChooseOption(fallbackOption.id)
      setMessage(
        direction === "left"
          ? "Narrativa descartada hacia la izquierda."
          : "Narrativa descartada hacia la derecha."
      )
      return
    }

    const nextCardResult = drawNextCard(bundle, state)
    setTimeline((prev) => [...prev, { state, currentCardId }])
    setState(nextCardResult.state)
    setCurrentCardId(nextCardResult.card?.id || null)
    setDebugEntries(nextCardResult.debug)
    setMessage(
      direction === "left"
        ? "Narrativa descartada hacia la izquierda."
        : "Narrativa descartada hacia la derecha."
    )
  }

  const isNarrativeCard = currentCard?.type === "narrative"
  const hasSwipeOptions = Boolean(currentCard && currentCard.options.length === 2)
  const leftSwipeOption = hasSwipeOptions ? currentCard?.options[0] : undefined
  const rightSwipeOption = hasSwipeOptions ? currentCard?.options[1] : undefined
  const canSwipeCard = mode === "play" && (isNarrativeCard || hasSwipeOptions)

  const getSideLabel = (direction: "left" | "right") => {
    if (hasSwipeOptions) {
      return direction === "left"
        ? leftSwipeOption?.text || "Izquierda"
        : rightSwipeOption?.text || "Derecha"
    }
    return direction === "left" ? "Izquierda" : "Derecha"
  }

  const onPointerDownCard = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canSwipeCard) return

    event.currentTarget.setPointerCapture(event.pointerId)
    setActivePointerId(event.pointerId)
    setDragStartX(event.clientX)
  }

  const onPointerMoveCard = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canSwipeCard) return
    if (activePointerId !== null && event.pointerId !== activePointerId) return
    if (dragStartX === null) return

    setDragOffsetX(event.clientX - dragStartX)
  }

  const onPointerEndCard = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canSwipeCard) return
    if (activePointerId !== null && event.pointerId !== activePointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (dragOffsetX <= -SWIPE_THRESHOLD) {
      if (hasSwipeOptions && leftSwipeOption) {
        onChooseOption(leftSwipeOption.id)
      } else {
        onSkipNarrative("left")
      }
    } else if (dragOffsetX >= SWIPE_THRESHOLD) {
      if (hasSwipeOptions && rightSwipeOption) {
        onChooseOption(rightSwipeOption.id)
      } else {
        onSkipNarrative("right")
      }
    }

    setDragStartX(null)
    setDragOffsetX(0)
    setActivePointerId(null)
  }

  const activeSwipeSide: "left" | "right" | null =
    dragOffsetX <= -PREVIEW_THRESHOLD ? "left" : dragOffsetX >= PREVIEW_THRESHOLD ? "right" : null

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

  const playStats = Object.entries(state.stats)

  if (mode === "play") {
    return (
      <div className="min-h-[72vh] rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 px-4 py-6 text-slate-100 md:px-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-100">{bundle.game.name}</h2>
              <p className="text-xs uppercase tracking-wide text-slate-400">Modo Reigns</p>
            </div>
            <button
              onClick={reset}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-700"
            >
              Reiniciar
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {playStats.map(([key, value]) => {
              const numericValue = Number(value)
              const percentage = Math.max(0, Math.min(100, numericValue))
              return (
                <div key={key} className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-slate-300">
                    <span>{key}</span>
                    <span>{numericValue}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300">{message}</p>

          <div className="relative mx-auto flex min-h-[480px] w-full max-w-md items-center justify-center">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
              <span className={`max-w-[40vw] truncate rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${activeSwipeSide === "left" ? "border-rose-300 bg-rose-500/35 text-rose-50 shadow-lg shadow-rose-900/30" : "border-slate-700 bg-slate-800/70 text-slate-400"}`}>
                {getSideLabel("left")}
              </span>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
              <span className={`max-w-[40vw] truncate rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${activeSwipeSide === "right" ? "border-cyan-200 bg-cyan-500/35 text-cyan-50 shadow-lg shadow-cyan-900/30" : "border-slate-700 bg-slate-800/70 text-slate-400"}`}>
                {getSideLabel("right")}
              </span>
            </div>

            {currentCard ? (
              <article
                onPointerDown={onPointerDownCard}
                onPointerMove={onPointerMoveCard}
                onPointerUp={onPointerEndCard}
                onPointerCancel={onPointerEndCard}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (!canSwipeCard) return
                  if (event.key === "ArrowLeft") {
                    if (hasSwipeOptions && leftSwipeOption) {
                      onChooseOption(leftSwipeOption.id)
                    } else {
                      onSkipNarrative("left")
                    }
                  }
                  if (event.key === "ArrowRight") {
                    if (hasSwipeOptions && rightSwipeOption) {
                      onChooseOption(rightSwipeOption.id)
                    } else {
                      onSkipNarrative("right")
                    }
                  }
                }}
                className={`relative w-full select-none rounded-2xl border border-slate-600 bg-gradient-to-b from-slate-100 to-slate-200 p-6 text-slate-900 shadow-2xl transition-transform duration-150 ${canSwipeCard ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{
                  transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX / 24}deg)`,
                }}
              >
                {hasSwipeOptions && (
                  <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide">
                    <div className={`rounded-md border px-2 py-1 ${activeSwipeSide === "left" ? "border-rose-400 bg-rose-100 text-rose-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}>
                      {leftSwipeOption?.text || "Izquierda"}
                    </div>
                    <div className={`rounded-md border px-2 py-1 text-right ${activeSwipeSide === "right" ? "border-cyan-400 bg-cyan-100 text-cyan-700" : "border-slate-300 bg-slate-100 text-slate-500"}`}>
                      {rightSwipeOption?.text || "Derecha"}
                    </div>
                  </div>
                )}

                <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-600">
                  <span>{currentCard.type}</span>
                  <span>Prioridad {currentCard.priority}</span>
                </div>

                <h3 className="text-2xl font-bold leading-tight">{currentCard.title}</h3>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{currentCard.description}</p>

                {currentCard.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentCard.tags.map((tag) => (
                      <span key={`${currentCard.id}-${tag}`} className="rounded-full border border-slate-400/60 bg-slate-200/80 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {canSwipeCard ? (
                  <p className="mt-6 rounded-md border border-slate-400/60 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {hasSwipeOptions
                      ? "Desliza izquierda/derecha para elegir opcion"
                      : "Desliza a izquierda o derecha para continuar"}
                  </p>
                ) : (
                  <div className="mt-5 space-y-2">
                    {currentCard.options.length > 0 ? (
                      currentCard.options.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => onChooseOption(option.id)}
                          className="block w-full rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-white"
                        >
                          {option.text}
                        </button>
                      ))
                    ) : (
                      <button
                        onClick={() => {
                          const nextCardResult = drawNextCard(bundle, state)
                          setState(nextCardResult.state)
                          setCurrentCardId(nextCardResult.card?.id || null)
                          setDebugEntries(nextCardResult.debug)
                          setMessage("Carta narrativa avanzada.")
                        }}
                        className="block w-full rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-white"
                      >
                        Continuar
                      </button>
                    )}
                  </div>
                )}
              </article>
            ) : (
              <div className="w-full rounded-2xl border border-dashed border-slate-600 bg-slate-800/60 p-6 text-center text-sm text-slate-300">
                No hay carta activa para el estado actual.
              </div>
            )}
          </div>
        </div>
      </div>
    )
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
