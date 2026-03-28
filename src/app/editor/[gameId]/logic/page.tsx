"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  bootstrapSelectionLogicSetup,
  fetchDecksByGameId,
  fetchGameLogicConfig,
  fetchStatsByGameId,
  fetchWorldStatesByGameId,
  saveGameLogicConfig,
} from "@/app/actions"
import {
  InteractionCounterConfig,
  InteractionRule,
  RuleOperator,
  RuleTriggerType,
  SelectionConditionSource,
  SelectionConstraintRule,
  SelectionWeightRule,
  SelectionWeightTargetType,
} from "@/lib/domain"

type DeckWeightRow = {
  id: string
  name: string
  type: string
  weight: number
}

const PROTECTED_COUNTER_KEYS = [
  "interactions.total",
  "interactions.cycle",
  "cards.shown.total",
  "cards.shown.cycle",
  "decks.completed.cycle",
]

const EVENT_OPTIONS: RuleTriggerType[] = [
  "any",
  "card_shown",
  "option_resolved",
  "stat_changed",
  "sequence_started",
  "sequence_completed",
  "sequence_paused",
]

const EVENT_FILTER_SUPPORT: Record<RuleTriggerType, { statKey: boolean; worldKey: boolean }> = {
  any: { statKey: false, worldKey: false },
  card_shown: { statKey: false, worldKey: false },
  option_resolved: { statKey: false, worldKey: false },
  stat_changed: { statKey: true, worldKey: false },
  sequence_started: { statKey: false, worldKey: false },
  sequence_completed: { statKey: false, worldKey: false },
  sequence_paused: { statKey: false, worldKey: true },
}

function compareByOperator(left: number, operator: RuleOperator, right: number) {
  switch (operator) {
    case "eq":
      return left === right
    case "gt":
      return left > right
    case "gte":
      return left >= right
    case "lt":
      return left < right
    case "lte":
      return left <= right
    default:
      return false
  }
}

function compareSelectionValues(
  left: number | string | boolean,
  operator: RuleOperator,
  right: number | string | boolean
) {
  if (operator === "eq") {
    return String(left) === String(right)
  }

  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    return false
  }

  return compareByOperator(leftNumber, operator, rightNumber)
}

export default function LogicPage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [logicCounters, setLogicCounters] = useState<InteractionCounterConfig[]>([])
  const [logicRules, setLogicRules] = useState<InteractionRule[]>([])
  const [logicWeightRules, setLogicWeightRules] = useState<SelectionWeightRule[]>([])
  const [logicConstraintRules, setLogicConstraintRules] = useState<SelectionConstraintRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [worldStateKeys, setWorldStateKeys] = useState<string[]>([])
  const [statKeys, setStatKeys] = useState<string[]>([])
  const [deckWeights, setDeckWeights] = useState<DeckWeightRow[]>([])

  const [counterForm, setCounterForm] = useState<InteractionCounterConfig>({
    key: "",
    scope: "global",
    description: "",
  })

  const [ruleForm, setRuleForm] = useState({
    trigger: "option_resolved" as RuleTriggerType,
    counterKey: "",
    operator: "gte" as RuleOperator,
    value: 1,
    filterStatKey: "",
    filterWorldKey: "",
    actionType: "increment_counter" as
      | "increment_counter"
      | "set_world_state"
      | "increment_world_state"
      | "set_stat"
      | "modify_stat",
    actionKey: "",
    actionValue: "",
  })

  const [weightRuleForm, setWeightRuleForm] = useState({
    targetType: "deck_type" as SelectionWeightTargetType,
    targetKey: "",
    operation: "multiply" as "add" | "multiply" | "set",
    value: 1,
    conditionSource: "" as "" | SelectionConditionSource,
    conditionKey: "",
    conditionOperator: "gte" as RuleOperator,
    conditionValue: "",
  })

  const [constraintRuleForm, setConstraintRuleForm] = useState({
    targetType: "deck_type" as SelectionWeightTargetType,
    targetKey: "",
    blockCounterKey: "",
    blockCounterOperator: "gte" as RuleOperator,
    blockCounterValue: 1,
    whenCounterKey: "",
    whenCounterOperator: "gte" as RuleOperator,
    whenCounterValue: 1,
  })

  const [weightPreview, setWeightPreview] = useState({
    source: "" as "" | SelectionConditionSource,
    key: "",
    value: "",
  })

  useEffect(() => {
    void loadLogic()
  }, [gameId])

  async function loadLogic() {
    try {
      setIsLoading(true)
      const [logic, worldStates, stats, decks] = await Promise.all([
        fetchGameLogicConfig(gameId),
        fetchWorldStatesByGameId(gameId),
        fetchStatsByGameId(gameId),
        fetchDecksByGameId(gameId),
      ])

      setLogicCounters(logic.counters || [])
      setLogicRules(logic.rules || [])
      setLogicWeightRules(logic.weightRules || [])
      setLogicConstraintRules(logic.constraintRules || [])
      setWorldStateKeys((worldStates || []).map((ws) => ws.key))
      setStatKeys((stats || []).map((stat) => stat.key))
      setDeckWeights(
        (decks || []).map((deck: { id: string; name: string; type: string; weight: number }) => ({
          id: deck.id,
          name: deck.name,
          type: deck.type,
          weight: Number.isFinite(deck.weight) && deck.weight > 0 ? deck.weight : 1,
        }))
      )
    } catch (error) {
      console.error("Error loading game logic:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function persistLogic(
    nextCounters: InteractionCounterConfig[],
    nextRules: InteractionRule[],
    nextWeightRules: SelectionWeightRule[] = logicWeightRules,
    nextConstraintRules: SelectionConstraintRule[] = logicConstraintRules
  ) {
    try {
      setFeedback("")
      setIsSaving(true)
      await saveGameLogicConfig(gameId, {
        counters: nextCounters,
        rules: nextRules,
        weightRules: nextWeightRules,
        constraintRules: nextConstraintRules,
      })
      setLogicCounters(nextCounters)
      setLogicRules(nextRules)
      setLogicWeightRules(nextWeightRules)
      setLogicConstraintRules(nextConstraintRules)
    } catch (error) {
      setFeedback("No se pudo guardar la logica")
      console.error("Error saving game logic:", error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBootstrapSelectionBase() {
    try {
      setFeedback("")
      setIsSaving(true)
      const result = await bootstrapSelectionLogicSetup(gameId)
      await loadLogic()
      setFeedback(
        `Base de seleccion creada. Contadores totales: ${result.countersTotal}. World states nuevos: ${result.createdWorldStates}.`
      )
    } catch (error) {
      setFeedback("No se pudo inicializar la base de seleccion")
      console.error("Error bootstrapping selection logic:", error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddCounter(e: React.FormEvent) {
    e.preventDefault()
    const key = counterForm.key.trim()

    if (!key) {
      setFeedback("Counter key es obligatoria")
      return
    }

    if (logicCounters.some((counter) => counter.key === key)) {
      setFeedback("Ya existe un contador con esa key")
      return
    }

    const nextCounters = [
      ...logicCounters,
      { key, scope: counterForm.scope, description: counterForm.description?.trim() || undefined },
    ]

    await persistLogic(nextCounters, logicRules)
    setCounterForm({ key: "", scope: "global", description: "" })
  }

  async function handleDeleteCounter(key: string) {
    if (PROTECTED_COUNTER_KEYS.includes(key)) {
      setFeedback("Este contador base esta protegido porque forma parte del runtime inicial")
      return
    }

    const nextCounters = logicCounters.filter((counter) => counter.key !== key)
    const nextRules = logicRules.filter((rule) => rule.when.counterKey !== key)
    await persistLogic(nextCounters, nextRules)
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault()

    const counterKey = ruleForm.counterKey.trim()
    const actionKey = ruleForm.actionKey.trim()
    const actionValue = ruleForm.actionValue.trim()

    if (!counterKey || !actionKey || !actionValue) {
      setFeedback("Regla incompleta: counter/action key/value son obligatorios")
      return
    }

    if (!logicCounters.some((counter) => counter.key === counterKey)) {
      setFeedback("La regla debe referenciar un contador existente")
      return
    }

    if (ruleForm.trigger === "stat_changed" && !ruleForm.filterStatKey.trim()) {
      setFeedback("Para evento stat_changed debes definir filtro Stat Key")
      return
    }

    const action =
      ruleForm.actionType === "increment_counter"
        ? {
            type: "increment_counter" as const,
            key: actionKey,
            amount: Number(actionValue || "1"),
          }
        : ruleForm.actionType === "set_world_state"
          ? {
              type: "set_world_state" as const,
              key: actionKey,
              value:
                actionValue === "true"
                  ? true
                  : actionValue === "false"
                    ? false
                    : Number.isNaN(Number(actionValue))
                      ? actionValue
                      : Number(actionValue),
            }
          : ruleForm.actionType === "increment_world_state"
            ? {
                type: "increment_world_state" as const,
                key: actionKey,
                amount: Number(actionValue),
              }
            : ruleForm.actionType === "set_stat"
              ? {
                  type: "set_stat" as const,
                  key: actionKey,
                  value: Number(actionValue),
                }
              : {
                  type: "modify_stat" as const,
                  key: actionKey,
                  amount: Number(actionValue),
                }

    if (
      ("amount" in action && !Number.isFinite(action.amount)) ||
      ("value" in action && typeof action.value === "number" && !Number.isFinite(action.value))
    ) {
      setFeedback("Regla invalida: valor numerico incorrecto")
      return
    }

    const rule: InteractionRule = {
      id: `rule-${Date.now()}`,
      trigger: ruleForm.trigger,
      filters: {
        statKey: ruleForm.filterStatKey.trim() || undefined,
        worldKey: ruleForm.filterWorldKey.trim() || undefined,
      },
      when: {
        counterKey,
        operator: ruleForm.operator,
        value: ruleForm.value,
      },
      actions: [action],
    }

    await persistLogic(logicCounters, [...logicRules, rule])
    setRuleForm({
      trigger: "option_resolved",
      counterKey: "",
      operator: "gte",
      value: 1,
      filterStatKey: "",
      filterWorldKey: "",
      actionType: "increment_counter",
      actionKey: "",
      actionValue: "",
    })
  }

  async function handleDeleteRule(ruleId: string) {
    await persistLogic(
      logicCounters,
      logicRules.filter((rule) => rule.id !== ruleId)
    )
  }

  async function handleAddWeightRule(e: React.FormEvent) {
    e.preventDefault()

    const targetKey = weightRuleForm.targetKey.trim()
    if (!targetKey) {
      setFeedback("La regla de peso requiere target key")
      return
    }

    if (!Number.isFinite(weightRuleForm.value)) {
      setFeedback("La regla de peso requiere valor numerico")
      return
    }

    if (weightRuleForm.conditionSource && !weightRuleForm.conditionKey.trim()) {
      setFeedback("La condicion generica de peso requiere key")
      return
    }

    let normalizedConditionValue: number | string | boolean = weightRuleForm.conditionValue
    if (weightRuleForm.conditionSource === "counter" || weightRuleForm.conditionSource === "stat") {
      const numericValue = Number(weightRuleForm.conditionValue)
      if (!Number.isFinite(numericValue)) {
        setFeedback("Counter/Stat condition requiere valor numerico")
        return
      }
      normalizedConditionValue = numericValue
    }

    if (weightRuleForm.conditionSource === "flag") {
      normalizedConditionValue = weightRuleForm.conditionValue === "true"
    }

    const nextWeightRule: SelectionWeightRule = {
      id: `weight-${Date.now()}`,
      targetType: weightRuleForm.targetType,
      targetKey,
      operation: weightRuleForm.operation,
      value: Number(weightRuleForm.value),
      conditions: weightRuleForm.conditionSource
        ? [
            {
              source: weightRuleForm.conditionSource,
              key: weightRuleForm.conditionKey.trim(),
              operator: weightRuleForm.conditionOperator,
              value: normalizedConditionValue,
            },
          ]
        : undefined,
    }

    await persistLogic(logicCounters, logicRules, [...logicWeightRules, nextWeightRule])

    setWeightRuleForm({
      targetType: "deck_type",
      targetKey: "",
      operation: "multiply",
      value: 1,
      conditionSource: "",
      conditionKey: "",
      conditionOperator: "gte",
      conditionValue: "",
    })
  }

  async function handleDeleteWeightRule(ruleId: string) {
    await persistLogic(
      logicCounters,
      logicRules,
      logicWeightRules.filter((rule) => rule.id !== ruleId)
    )
  }

  async function handleAddConstraintRule(e: React.FormEvent) {
    e.preventDefault()

    const targetKey = constraintRuleForm.targetKey.trim()
    if (!targetKey) {
      setFeedback("La regla de restriccion requiere target key")
      return
    }

    if (!constraintRuleForm.blockCounterKey.trim()) {
      setFeedback("La regla de restriccion requiere Block Counter Key")
      return
    }

    const nextConstraintRule: SelectionConstraintRule = {
      id: `constraint-${Date.now()}`,
      targetType: constraintRuleForm.targetType,
      targetKey,
      counterCondition: {
        counterKey: constraintRuleForm.blockCounterKey.trim(),
        operator: constraintRuleForm.blockCounterOperator,
        value: Number(constraintRuleForm.blockCounterValue),
      },
      whenCounter: constraintRuleForm.whenCounterKey.trim()
        ? {
            counterKey: constraintRuleForm.whenCounterKey.trim(),
            operator: constraintRuleForm.whenCounterOperator,
            value: Number(constraintRuleForm.whenCounterValue),
          }
        : undefined,
    }

    await persistLogic(logicCounters, logicRules, logicWeightRules, [...logicConstraintRules, nextConstraintRule])

    setConstraintRuleForm({
      targetType: "deck_type",
      targetKey: "",
      blockCounterKey: "",
      blockCounterOperator: "gte",
      blockCounterValue: 1,
      whenCounterKey: "",
      whenCounterOperator: "gte",
      whenCounterValue: 1,
    })
  }

  async function handleDeleteConstraintRule(ruleId: string) {
    await persistLogic(
      logicCounters,
      logicRules,
      logicWeightRules,
      logicConstraintRules.filter((rule) => rule.id !== ruleId)
    )
  }

  const selectionCounters = logicCounters.filter((counter) => PROTECTED_COUNTER_KEYS.includes(counter.key))

  const sortedDeckWeights = [...deckWeights].sort((left, right) => {
    if (left.weight !== right.weight) return right.weight - left.weight
    return left.id.localeCompare(right.id)
  })

  const totalDeckWeight = deckWeights.reduce((sum, deck) => sum + deck.weight, 0)

  const deckTypeOptions = Array.from(new Set(deckWeights.map((deck) => deck.type).filter(Boolean))).sort()
  const weightTargetOptions =
    weightRuleForm.targetType === "deck_id"
      ? sortedDeckWeights.map((deck) => ({ key: deck.id, label: `${deck.name} (${deck.id.slice(0, 8)})` }))
      : deckTypeOptions.map((type) => ({ key: type, label: type }))

  const constraintTargetOptions =
    constraintRuleForm.targetType === "deck_id"
      ? sortedDeckWeights.map((deck) => ({ key: deck.id, label: `${deck.name} (${deck.id.slice(0, 8)})` }))
      : deckTypeOptions.map((type) => ({ key: type, label: type }))

  const previewRows = sortedDeckWeights.map((deck) => {
    let effectiveWeight = deck.weight

    for (const weightRule of logicWeightRules) {
      const matchesTarget =
        (weightRule.targetType === "deck_id" && weightRule.targetKey === deck.id) ||
        (weightRule.targetType === "deck_type" && weightRule.targetKey === deck.type)
      if (!matchesTarget) continue

      if (weightRule.conditions && weightRule.conditions.length > 0) {
        const matchesAll = weightRule.conditions.every((condition) => {
          if (condition.source !== weightPreview.source) return false
          if (condition.key !== weightPreview.key.trim()) return false
          return compareSelectionValues(weightPreview.value, condition.operator, condition.value)
        })
        if (!matchesAll) continue
      }

      if (weightRule.operation === "set") effectiveWeight = weightRule.value
      if (weightRule.operation === "add") effectiveWeight += weightRule.value
      if (weightRule.operation === "multiply") effectiveWeight *= weightRule.value
    }

    const normalized = Number.isFinite(effectiveWeight) ? Math.max(effectiveWeight, 0) : 0
    return { deck, effectiveWeight: normalized }
  })

  const previewTotal = previewRows.reduce((sum, row) => sum + row.effectiveWeight, 0)
  const previewSortedRows = [...previewRows].sort((left, right) => {
    if (left.effectiveWeight !== right.effectiveWeight) return right.effectiveWeight - left.effectiveWeight
    return left.deck.id.localeCompare(right.deck.id)
  })

  const supportsStatFilter = EVENT_FILTER_SUPPORT[ruleForm.trigger]?.statKey
  const supportsWorldFilter = EVENT_FILTER_SUPPORT[ruleForm.trigger]?.worldKey

  const actionKeyOptions =
    ruleForm.actionType === "increment_counter"
      ? logicCounters.map((counter) => counter.key)
      : ruleForm.actionType === "set_stat" || ruleForm.actionType === "modify_stat"
        ? statKeys
        : worldStateKeys

  const isCustomActionKey = !!ruleForm.actionKey && !actionKeyOptions.includes(ruleForm.actionKey)

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="max-w-5xl p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Game Logic</h1>
        <p className="mt-2 text-slate-400">
          Define contadores y reglas orientadas a eventos. El codigo no depende de stats o world state fijos por juego.
        </p>
      </div>

      <section className="rounded bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">Eventos Disponibles En Runtime</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {EVENT_OPTIONS.map((eventName) => (
            <span key={eventName} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200">
              {eventName}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">Preview de pesos efectivos</h2>
        <p className="text-sm text-slate-400">Simula un valor de condicion generica (source/key/value).</p>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={weightPreview.source}
            onChange={(e) => setWeightPreview((prev) => ({ ...prev, source: e.target.value as "" | SelectionConditionSource, key: "" }))}
            className="rounded bg-slate-700 px-4 py-2 text-white"
          >
            <option value="">source (opcional)</option>
            <option value="counter">counter</option>
            <option value="stat">stat</option>
            <option value="world">world</option>
            <option value="flag">flag</option>
          </select>
          <input
            type="text"
            value={weightPreview.key}
            onChange={(e) => setWeightPreview((prev) => ({ ...prev, key: e.target.value }))}
            className="rounded bg-slate-700 px-4 py-2 text-white"
            placeholder="condition key"
          />
          <input
            type="text"
            value={weightPreview.value}
            onChange={(e) => setWeightPreview((prev) => ({ ...prev, value: e.target.value }))}
            className="rounded bg-slate-700 px-4 py-2 text-white"
            placeholder="condition value"
          />
        </div>
        <div className="space-y-2">
          {previewSortedRows.map((row, index) => {
            const chance = previewTotal > 0 ? ((row.effectiveWeight / previewTotal) * 100).toFixed(1) : "0.0"
            return (
              <div
                key={row.deck.id}
                className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                  index === 0
                    ? "border-emerald-500/60 bg-emerald-950/30 text-emerald-200"
                    : "border-slate-600 bg-slate-900 text-slate-200"
                }`}
              >
                <span>{row.deck.name} ({row.deck.type})</span>
                <span>base: {row.deck.weight} -> efectivo: {row.effectiveWeight} · {chance}%</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded bg-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Seleccion de cartas (base de runtime)</h2>
            <p className="text-sm text-slate-400 mt-1">Inicializa contadores base y world states recomendados desde UI.</p>
          </div>
          <button
            type="button"
            onClick={handleBootstrapSelectionBase}
            disabled={isSaving}
            className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Inicializar base
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Contadores base protegidos</p>
            <ul className="space-y-1 text-sm">
              {PROTECTED_COUNTER_KEYS.map((key) => {
                const exists = selectionCounters.some((counter) => counter.key === key)
                return (
                  <li key={key} className={exists ? "text-emerald-300" : "text-amber-300"}>
                    {exists ? "OK" : "Pendiente"} · {key}
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">World states recomendados</p>
            <ul className="space-y-1 text-sm">
              {["world.cycle", "world.day", "world.phase", "world.context"].map((key) => {
                const exists = worldStateKeys.includes(key)
                return (
                  <li key={key} className={exists ? "text-emerald-300" : "text-amber-300"}>
                    {exists ? "OK" : "Pendiente"} · {key}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded bg-slate-800 p-4 space-y-4">
        <div>
          <h2 className="font-semibold">Reglas de peso (genericas)</h2>
          <p className="text-sm text-slate-400 mt-1">Selector por target + condicion generica opcional.</p>
        </div>
        <form onSubmit={handleAddWeightRule} className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">Target Type</label>
            <select
              value={weightRuleForm.targetType}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, targetType: e.target.value as SelectionWeightTargetType, targetKey: "" }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="deck_type">deck_type</option>
              <option value="deck_id">deck_id</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Target Key</label>
            <select
              value={weightRuleForm.targetKey}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, targetKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              required
            >
              <option value="">Selecciona target</option>
              {weightTargetOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Operacion</label>
            <select
              value={weightRuleForm.operation}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, operation: e.target.value as "add" | "multiply" | "set" }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="multiply">multiply</option>
              <option value="add">add</option>
              <option value="set">set</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Valor</label>
            <input
              type="number"
              step="0.1"
              value={weightRuleForm.value}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Condicion source (opcional)</label>
            <select
              value={weightRuleForm.conditionSource}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, conditionSource: e.target.value as "" | SelectionConditionSource, conditionKey: "", conditionValue: "" }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="">Sin condicion</option>
              <option value="counter">counter</option>
              <option value="stat">stat</option>
              <option value="world">world</option>
              <option value="flag">flag</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Condicion key</label>
            <input
              type="text"
              value={weightRuleForm.conditionKey}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, conditionKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!weightRuleForm.conditionSource}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Condicion operador</label>
            <select
              value={weightRuleForm.conditionOperator}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, conditionOperator: e.target.value as RuleOperator }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!weightRuleForm.conditionSource}
            >
              <option value="eq">eq</option>
              <option value="gt">gt</option>
              <option value="gte">gte</option>
              <option value="lt">lt</option>
              <option value="lte">lte</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Condicion value</label>
            <input
              type="text"
              value={weightRuleForm.conditionValue}
              onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, conditionValue: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!weightRuleForm.conditionSource}
            />
          </div>

          <button type="submit" className="md:col-span-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Agregar regla de peso
          </button>
        </form>

        <div className="space-y-2">
          {logicWeightRules.length === 0 ? (
            <p className="text-sm text-slate-400">Sin reglas de peso.</p>
          ) : (
            logicWeightRules.map((rule) => (
              <div key={rule.id} className="rounded bg-slate-700/50 p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">{rule.targetType}:{rule.targetKey} · {rule.operation} {rule.value}</p>
                  {rule.conditions && rule.conditions.length > 0 ? (
                    <p className="text-xs text-slate-400">
                      condicion: {rule.conditions[0].source}:{rule.conditions[0].key} {rule.conditions[0].operator} {String(rule.conditions[0].value)}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-300">regla legacy sin condicion generica</p>
                  )}
                </div>
                <button onClick={() => void handleDeleteWeightRule(rule.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded bg-slate-800 p-4 space-y-4">
        <div>
          <h2 className="font-semibold">Reglas de restriccion (hard constraints)</h2>
          <p className="text-sm text-slate-400 mt-1">Bloquean candidatos por selector cuando un counter cumple una condicion.</p>
        </div>

        <form onSubmit={handleAddConstraintRule} className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">Target Type</label>
            <select
              value={constraintRuleForm.targetType}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, targetType: e.target.value as SelectionWeightTargetType, targetKey: "" }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="deck_type">deck_type</option>
              <option value="deck_id">deck_id</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Target Key</label>
            <select
              value={constraintRuleForm.targetKey}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, targetKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              required
            >
              <option value="">Selecciona target</option>
              {constraintTargetOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Block Counter Key</label>
            <select
              value={constraintRuleForm.blockCounterKey}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, blockCounterKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              required
            >
              <option value="">Selecciona counter</option>
              {logicCounters.map((counter) => (
                <option key={counter.key} value={counter.key}>{counter.key}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={constraintRuleForm.blockCounterOperator}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, blockCounterOperator: e.target.value as RuleOperator }))}
              className="rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!constraintRuleForm.blockCounterKey}
            >
              <option value="eq">eq</option>
              <option value="gt">gt</option>
              <option value="gte">gte</option>
              <option value="lt">lt</option>
              <option value="lte">lte</option>
            </select>
            <input
              type="number"
              value={constraintRuleForm.blockCounterValue}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, blockCounterValue: Number(e.target.value) }))}
              className="rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!constraintRuleForm.blockCounterKey}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">When Counter Key (opcional)</label>
            <select
              value={constraintRuleForm.whenCounterKey}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, whenCounterKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="">Sin condicion de activacion</option>
              {logicCounters.map((counter) => (
                <option key={counter.key} value={counter.key}>{counter.key}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={constraintRuleForm.whenCounterOperator}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, whenCounterOperator: e.target.value as RuleOperator }))}
              className="rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!constraintRuleForm.whenCounterKey}
            >
              <option value="eq">eq</option>
              <option value="gt">gt</option>
              <option value="gte">gte</option>
              <option value="lt">lt</option>
              <option value="lte">lte</option>
            </select>
            <input
              type="number"
              value={constraintRuleForm.whenCounterValue}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, whenCounterValue: Number(e.target.value) }))}
              className="rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!constraintRuleForm.whenCounterKey}
            />
          </div>

          <button type="submit" className="md:col-span-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Agregar regla de restriccion
          </button>
        </form>

        <div className="space-y-2">
          {logicConstraintRules.length === 0 ? (
            <p className="text-sm text-slate-400">Sin reglas de restriccion.</p>
          ) : (
            logicConstraintRules.map((rule) => (
              <div key={rule.id} className="rounded bg-slate-700/50 p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">{rule.targetType}:{rule.targetKey}</p>
                  {rule.counterCondition && (
                    <p className="text-xs text-slate-400">
                      bloquea cuando: {rule.counterCondition.counterKey} {rule.counterCondition.operator} {rule.counterCondition.value}
                    </p>
                  )}
                  {rule.whenCounter && (
                    <p className="text-xs text-slate-400">
                      when: {rule.whenCounter.counterKey} {rule.whenCounter.operator} {rule.whenCounter.value}
                    </p>
                  )}
                </div>
                <button onClick={() => void handleDeleteConstraintRule(rule.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {feedback && <p className="text-sm text-amber-300">{feedback}</p>}
      {isSaving && <p className="text-xs text-slate-300">Guardando...</p>}

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={handleAddCounter} className="space-y-3 rounded bg-slate-800 p-4">
          <h2 className="font-semibold">Nuevo Contador</h2>
          <div>
            <label className="mb-1 block text-sm font-semibold">Key</label>
            <input
              type="text"
              value={counterForm.key}
              onChange={(e) => setCounterForm((prev) => ({ ...prev, key: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              placeholder="interactions.custom o player.progress"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Scope</label>
            <select
              value={counterForm.scope}
              onChange={(e) => setCounterForm((prev) => ({ ...prev, scope: e.target.value as "global" | "deck" | "card" }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="global">global</option>
              <option value="deck">deck</option>
              <option value="card">card</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Descripcion</label>
            <input
              type="text"
              value={counterForm.description || ""}
              onChange={(e) => setCounterForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            />
          </div>
          <button type="submit" className="w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">Agregar contador</button>
        </form>

        <form onSubmit={handleAddRule} className="space-y-3 rounded bg-slate-800 p-4">
          <h2 className="font-semibold">Nueva Regla</h2>
          <div>
            <label className="mb-1 block text-sm font-semibold">Evento</label>
            <select
              value={ruleForm.trigger}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, trigger: e.target.value as RuleTriggerType }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              {EVENT_OPTIONS.map((eventName) => (
                <option key={eventName} value={eventName}>{eventName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Counter Key (condicion)</label>
            <select
              value={ruleForm.counterKey}
              onChange={(e) => setRuleForm((prev) => ({ ...prev, counterKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              required
            >
              <option value="">Selecciona un contador</option>
              {logicCounters.map((counter) => (
                <option key={counter.key} value={counter.key}>{counter.key}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Operador</label>
              <select
                value={ruleForm.operator}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, operator: e.target.value as RuleOperator }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              >
                <option value="eq">eq</option>
                <option value="gt">gt</option>
                <option value="gte">gte</option>
                <option value="lt">lt</option>
                <option value="lte">lte</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Valor</label>
              <input
                type="number"
                value={ruleForm.value}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>
          </div>

          {(supportsStatFilter || supportsWorldFilter) && (
            <div className="grid grid-cols-2 gap-3">
              {supportsStatFilter && (
                <div>
                  <label className="mb-1 block text-sm font-semibold">Filtro Stat Key</label>
                  <select
                    value={ruleForm.filterStatKey}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, filterStatKey: e.target.value }))}
                    className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                  >
                    <option value="">Selecciona stat</option>
                    {statKeys.map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>
              )}
              {supportsWorldFilter && (
                <div>
                  <label className="mb-1 block text-sm font-semibold">Filtro World Key</label>
                  <select
                    value={ruleForm.filterWorldKey}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, filterWorldKey: e.target.value }))}
                    className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                  >
                    <option value="">Selecciona world state</option>
                    {worldStateKeys.map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold">Accion De Regla</label>
            <select
              value={ruleForm.actionType}
              onChange={(e) =>
                setRuleForm((prev) => ({
                  ...prev,
                  actionType: e.target.value as
                    | "increment_counter"
                    | "set_world_state"
                    | "increment_world_state"
                    | "set_stat"
                    | "modify_stat",
                }))
              }
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="increment_counter">increment_counter</option>
              <option value="set_world_state">set_world_state</option>
              <option value="increment_world_state">increment_world_state</option>
              <option value="set_stat">set_stat</option>
              <option value="modify_stat">modify_stat</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Action Key</label>
              <select
                value={isCustomActionKey ? "__custom__" : ruleForm.actionKey}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setRuleForm((prev) => ({ ...prev, actionKey: "" }))
                    return
                  }
                  setRuleForm((prev) => ({ ...prev, actionKey: e.target.value }))
                }}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required={!isCustomActionKey}
              >
                <option value="">Selecciona action key</option>
                {actionKeyOptions.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
                <option value="__custom__">custom...</option>
              </select>
              {(isCustomActionKey || actionKeyOptions.length === 0) && (
                <input
                  type="text"
                  value={ruleForm.actionKey}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, actionKey: e.target.value }))}
                  className="mt-2 w-full rounded bg-slate-700 px-4 py-2 text-white"
                  placeholder="Escribe action key"
                  required
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Action Value</label>
              <input
                type="text"
                value={ruleForm.actionValue}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, actionValue: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>
          </div>

          <button type="submit" className="w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">Agregar regla</button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2 rounded bg-slate-800 p-4">
          <h2 className="font-semibold">Contadores</h2>
          {logicCounters.length === 0 ? (
            <p className="text-sm text-slate-400">Sin contadores</p>
          ) : (
            logicCounters.map((counter) => (
              <div key={counter.key} className="rounded bg-slate-700/50 p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{counter.key}</p>
                  <p className="text-xs text-slate-400">scope: {counter.scope}</p>
                  {PROTECTED_COUNTER_KEYS.includes(counter.key) && (
                    <p className="text-xs text-amber-300">protegido por runtime base</p>
                  )}
                </div>
                <button
                  onClick={() => void handleDeleteCounter(counter.key)}
                  disabled={PROTECTED_COUNTER_KEYS.includes(counter.key)}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 rounded bg-slate-800 p-4">
          <h2 className="font-semibold">Reglas</h2>
          {logicRules.length === 0 ? (
            <p className="text-sm text-slate-400">Sin reglas</p>
          ) : (
            logicRules.map((rule) => (
              <div key={rule.id} className="rounded bg-slate-700/50 p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="text-xs text-slate-300">evento: {rule.trigger || "any"}</p>
                  <p className="font-semibold">{rule.when.counterKey} {rule.when.operator} {rule.when.value}</p>
                  <p className="text-xs text-slate-400">acciones: {rule.actions.length}</p>
                </div>
                <button
                  onClick={() => void handleDeleteRule(rule.id)}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
