"use client"

import { useMemo, useState } from "react"
import {
  advanceCardWithoutOption,
  applySelectedOption,
  buildInitialGameState,
  drawNextCard,
  resetGameSession,
} from "@/lib/play/runtime"
import { PlayRuntimeBundle } from "@/lib/services/prisma/playRuntime"
import { GameState } from "@/lib/domain"
import { RuntimeRuleTraceEntry } from "@/lib/engine/ruleEngine"

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


export default function RuntimeSession({ bundle, mode }: RuntimeSessionProps) {
  console.log("🎮 RuntimeSession loaded - game ready")
  
  const initialRuntime = useMemo(() => {
    const initialState = buildInitialGameState(bundle)
    const firstCardResult = drawNextCard(bundle, initialState)

    return {
      state: firstCardResult.state,
      currentCardId: firstCardResult.card?.id || null,
      ruleEvents: firstCardResult.ruleEvents || [],
      message: firstCardResult.message || (firstCardResult.card ? "Carta inicial seleccionada." : "Sin carta disponible."),
    }
  }, [bundle])

  const [state, setState] = useState<GameState>(() => initialRuntime.state)
  const [currentCardId, setCurrentCardId] = useState<string | null>(() => initialRuntime.currentCardId)
  const [message, setMessage] = useState<string>(() => initialRuntime.message)
  const [dragStartX, setDragStartX] = useState<number | null>(null)
  const [dragOffsetX, setDragOffsetX] = useState(0)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)
  const [recentRuleEvents, setRecentRuleEvents] = useState<RuntimeRuleTraceEntry[]>(() => initialRuntime.ruleEvents)

  const currentCard = useMemo(
    () => bundle.cards.find((card) => card.id === currentCardId) || null,
    [bundle.cards, currentCardId]
  )

  const applyRuntimeTransition = (nextState: GameState, nextCardId: string | null, nextMessage: string) => {
    setState(nextState)
    setCurrentCardId(nextCardId)
    setMessage(nextMessage)
  }

  const applyRuntimeTransitionWithEvents = (
    nextState: GameState,
    nextCardId: string | null,
    nextMessage: string,
    events: RuntimeRuleTraceEntry[]
  ) => {
    applyRuntimeTransition(nextState, nextCardId, nextMessage)
    setRecentRuleEvents(events)
  }

  // Debug: Log current state info
  if (currentCard && currentCardId) {
    const currentDeck = bundle.decks.find((d) => d.id === currentCard.deckId)
    const isCompleted = state.completedDecks.includes(currentCard.deckId)
    console.log(`[CURRENT CARD] "${currentCard.title}" (${currentCardId})`, {
      deckId: currentCard.deckId,
      deckName: currentDeck?.name,
      deckRepeatable: currentDeck?.repeatable,
      deckCompleted: isCompleted,
      completedDecks: state.completedDecks,
      optionsCount: currentCard.options?.length || 0,
    })
  }

  const onChooseOption = (optionId: string) => {
    if (!currentCard) return

    console.log(`[onChooseOption] Card: "${currentCard.title}", Option: ${optionId}`)
    const optionResult = applySelectedOption(bundle, state, currentCard.id, optionId)
    console.log(`[applySelectedOption result] completedDecks:`, optionResult.state.completedDecks)
    
    // Pass excludeCardId to avoid showing the same card again
    const nextCardResult = drawNextCard(bundle, optionResult.state, currentCard.id)
    console.log(`[drawNextCard result] Card Selected:`, nextCardResult.card?.title, nextCardResult.message)

    const transitionEvents = [...(optionResult.events || []), ...(nextCardResult.ruleEvents || [])]

    applyRuntimeTransitionWithEvents(
      nextCardResult.state,
      nextCardResult.card?.id || null,
      optionResult.message ||
        nextCardResult.message ||
        (nextCardResult.card ? "Opcion aplicada y siguiente carta seleccionada por peso." : "Opcion aplicada."),
      transitionEvents
    )
  }

  const onAdvanceCardWithoutOption = () => {
    if (!currentCard) return

    const advanceResult = advanceCardWithoutOption(bundle, state, currentCard.id)
    const nextCardResult = drawNextCard(bundle, advanceResult.state, currentCard.id)
    applyRuntimeTransitionWithEvents(
      nextCardResult.state,
      nextCardResult.card?.id || null,
      "Carta avanzada sin opcion.",
      [...advanceResult.events, ...(nextCardResult.ruleEvents || [])]
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

    // Emit sequence_paused when user exits a sequence manually.
    const advanceResult = advanceCardWithoutOption(bundle, state, currentCard.id)
    const nextCardResult = drawNextCard(bundle, advanceResult.state, currentCard.id)
    applyRuntimeTransitionWithEvents(
      nextCardResult.state,
      nextCardResult.card?.id || null,
      direction === "left"
        ? "Narrativa descartada hacia la izquierda."
        : "Narrativa descartada hacia la derecha.",
      [...advanceResult.events, ...(nextCardResult.ruleEvents || [])]
    )
  }

  const isNarrativeCard = currentCard?.type === "narrative"
  const hasSwipeOptions = Boolean(currentCard && currentCard.options.length === 2)
  const leftSwipeOption = hasSwipeOptions ? currentCard?.options[0] : undefined
  const rightSwipeOption = hasSwipeOptions ? currentCard?.options[1] : undefined
  const canSwipeCard = Boolean(isNarrativeCard || hasSwipeOptions)

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

  const reset = () => {
    const nextInitialState = resetGameSession(bundle)
    const nextFirstCardResult = drawNextCard(bundle, nextInitialState)

    setState(nextFirstCardResult.state)
    setCurrentCardId(nextFirstCardResult.card?.id || null)
    setMessage(nextFirstCardResult.message || "Sesion reiniciada.")
    setRecentRuleEvents(nextFirstCardResult.ruleEvents || [])
    setDragStartX(null)
    setDragOffsetX(0)
    setActivePointerId(null)
  }

  const playStats = Object.entries(state.stats)
  const allCounters = {
    "interactions.total": Number(state.interactions?.total || 0),
    ...(typeof state.turn === "number" ? { turn: state.turn } : {}),
    ...(state.interactions?.counters || {}),
  }

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
                        onClick={onAdvanceCardWithoutOption}
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
                <div className="mb-2 text-3xl">∅</div>
                <p className="font-semibold text-slate-200">No hay más cartas</p>
                <p className="mt-1 text-xs text-slate-400">Se completaron todas las secuencias disponibles para el estado actual.</p>
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
          <button
            onClick={reset}
            className="rounded border px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Reiniciar
          </button>
        </div>

        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</p>

        <div className="relative mx-auto flex min-h-[460px] w-full max-w-md items-center justify-center">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
            <span
              className={`max-w-[40vw] truncate rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                activeSwipeSide === "left"
                  ? "border-rose-300 bg-rose-100 text-rose-700"
                  : "border-slate-300 bg-slate-100 text-slate-500"
              }`}
            >
              {getSideLabel("left")}
            </span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
            <span
              className={`max-w-[40vw] truncate rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                activeSwipeSide === "right"
                  ? "border-cyan-300 bg-cyan-100 text-cyan-700"
                  : "border-slate-300 bg-slate-100 text-slate-500"
              }`}
            >
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
              className={`relative w-full select-none rounded-2xl border border-slate-300 bg-gradient-to-b from-slate-50 to-slate-100 p-6 text-slate-900 shadow-lg transition-transform duration-150 ${canSwipeCard ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{
                transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX / 24}deg)`,
              }}
            >
              {hasSwipeOptions && (
                <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide">
                  <div
                    className={`rounded-md border px-2 py-1 ${
                      activeSwipeSide === "left"
                        ? "border-rose-400 bg-rose-100 text-rose-700"
                        : "border-slate-300 bg-slate-100 text-slate-500"
                    }`}
                  >
                    {leftSwipeOption?.text || "Izquierda"}
                  </div>
                  <div
                    className={`rounded-md border px-2 py-1 text-right ${
                      activeSwipeSide === "right"
                        ? "border-cyan-400 bg-cyan-100 text-cyan-700"
                        : "border-slate-300 bg-slate-100 text-slate-500"
                    }`}
                  >
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
                    <span
                      key={`${currentCard.id}-${tag}`}
                      className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {canSwipeCard ? (
                <p className="mt-6 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {hasSwipeOptions
                    ? "Desliza izquierda/derecha para elegir opcion"
                    : "Desliza a izquierda o derecha para continuar"}
                </p>
              ) : currentCard.options.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {currentCard.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => onChooseOption(option.id)}
                      className="block w-full rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium hover:bg-slate-50"
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={onAdvanceCardWithoutOption}
                  className="mt-5 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Continuar
                </button>
              )}
            </article>
          ) : (
            <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No hay carta activa para el estado actual.
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Contadores</h3>
          <div className="space-y-2">
            {Object.keys(allCounters).length === 0 ? (
              <p className="text-xs text-gray-500">Sin contadores.</p>
            ) : (
              Object.entries(allCounters).map(([key, value]) => (
                <StatLine key={key} label={key} value={Number(value)} />
              ))
            )}
          </div>
        </section>

        <section className="rounded border bg-white p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Variables</h3>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Stats</p>
            <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
              {toPrettyJson(state.stats)}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Flags</p>
            <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
              {toPrettyJson(state.flags)}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">World State</p>
            <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
              {toPrettyJson(state.world)}
            </pre>
          </div>
        </section>

        <section className="rounded border bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Eventos disparados</h3>
          {recentRuleEvents.length === 0 ? (
            <p className="text-xs text-gray-500">Sin eventos en la ultima transicion.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-auto">
              {recentRuleEvents.map((entry, index) => (
                <div key={`${entry.event.type}-${entry.event.counterKey || ""}-${index}`} className="rounded bg-gray-50 p-2 text-xs text-gray-700">
                  <p className="font-semibold text-gray-900">{index + 1}. {entry.event.type}</p>
                  <p>source: {entry.source}</p>
                  {entry.event.counterKey && <p>counterKey: {entry.event.counterKey}</p>}
                  {entry.event.statKey && <p>statKey: {entry.event.statKey}</p>}
                  {entry.event.worldKey && <p>worldKey: {entry.event.worldKey}</p>}
                  {entry.event.cardId && <p>cardId: {entry.event.cardId}</p>}
                  {entry.event.optionId && <p>optionId: {entry.event.optionId}</p>}
                  {entry.viaRuleId && <p>viaRuleId: {entry.viaRuleId}</p>}
                  {entry.viaActionType && <p>viaAction: {entry.viaActionType}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}
