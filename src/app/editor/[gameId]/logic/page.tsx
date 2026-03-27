"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { fetchGameLogicConfig, saveGameLogicConfig } from "@/app/actions"
import { InteractionCounterConfig, InteractionRule } from "@/lib/domain"

export default function LogicPage() {
  const params = useParams()
  const gameId = params.gameId as string

  const [logicCounters, setLogicCounters] = useState<InteractionCounterConfig[]>([])
  const [logicRules, setLogicRules] = useState<InteractionRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState("")

  const [counterForm, setCounterForm] = useState<InteractionCounterConfig>({
    key: "",
    scope: "global",
    description: "",
  })

  const [ruleForm, setRuleForm] = useState({
    counterKey: "",
    operator: "gte" as "eq" | "gt" | "gte" | "lt" | "lte",
    value: 1,
    actionType: "set_world_state" as
      | "set_world_state"
      | "increment_world_state"
      | "set_stat"
      | "modify_stat",
    actionKey: "",
    actionValue: "",
  })

  useEffect(() => {
    loadLogic()
  }, [gameId])

  async function loadLogic() {
    try {
      setIsLoading(true)
      const logic = (await fetchGameLogicConfig(gameId)) as {
        counters: InteractionCounterConfig[]
        rules: InteractionRule[]
      }
      setLogicCounters(logic.counters || [])
      setLogicRules(logic.rules || [])
    } catch (error) {
      console.error("Error loading game logic:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function persistLogic(nextCounters: InteractionCounterConfig[], nextRules: InteractionRule[]) {
    try {
      setFeedback("")
      setIsSaving(true)
      await saveGameLogicConfig(gameId, { counters: nextCounters, rules: nextRules })
      setLogicCounters(nextCounters)
      setLogicRules(nextRules)
    } catch (error) {
      setFeedback("No se pudo guardar la logica")
      console.error("Error saving game logic:", error)
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

    if (logicCounters.some((c) => c.key === key)) {
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
    const nextCounters = logicCounters.filter((c) => c.key !== key)
    const nextRules = logicRules.filter((r) => r.when.counterKey !== key)
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

    if (!logicCounters.some((c) => c.key === counterKey)) {
      setFeedback("La regla debe referenciar un contador existente")
      return
    }

    const action =
      ruleForm.actionType === "set_world_state"
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
      when: {
        counterKey,
        operator: ruleForm.operator,
        value: ruleForm.value,
      },
      actions: [action],
    }

    const nextRules = [...logicRules, rule]
    await persistLogic(logicCounters, nextRules)
    setRuleForm({
      counterKey: "",
      operator: "gte",
      value: 1,
      actionType: "set_world_state",
      actionKey: "",
      actionValue: "",
    })
  }

  async function handleDeleteRule(ruleId: string) {
    const nextRules = logicRules.filter((r) => r.id !== ruleId)
    await persistLogic(logicCounters, nextRules)
  }

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="max-w-5xl p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Game Logic</h1>
        <p className="mt-2 text-slate-400">
          Define contadores (cartas/interacciones) y reglas que modifican variables cuando se cumplen condiciones.
        </p>
      </div>

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
              onChange={(e) => setCounterForm((p) => ({ ...p, key: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              placeholder="interactions.global o cards.type.decision"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Scope</label>
            <select
              value={counterForm.scope}
              onChange={(e) => setCounterForm((p) => ({ ...p, scope: e.target.value as "global" | "deck" | "card" }))}
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
              onChange={(e) => setCounterForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            />
          </div>
          <button type="submit" className="w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Agregar contador
          </button>
        </form>

        <form onSubmit={handleAddRule} className="space-y-3 rounded bg-slate-800 p-4">
          <h2 className="font-semibold">Nueva Regla</h2>
          <div>
            <label className="mb-1 block text-sm font-semibold">Counter Key</label>
            <input
              type="text"
              value={ruleForm.counterKey}
              onChange={(e) => setRuleForm((p) => ({ ...p, counterKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Operador</label>
              <select
                value={ruleForm.operator}
                onChange={(e) => setRuleForm((p) => ({ ...p, operator: e.target.value as "eq" | "gt" | "gte" | "lt" | "lte" }))}
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
                onChange={(e) => setRuleForm((p) => ({ ...p, value: Number(e.target.value) }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Accion</label>
            <select
              value={ruleForm.actionType}
              onChange={(e) =>
                setRuleForm((p) => ({
                  ...p,
                  actionType: e.target.value as "set_world_state" | "increment_world_state" | "set_stat" | "modify_stat",
                }))
              }
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="set_world_state">set_world_state</option>
              <option value="increment_world_state">increment_world_state</option>
              <option value="set_stat">set_stat</option>
              <option value="modify_stat">modify_stat</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Action Key</label>
              <input
                type="text"
                value={ruleForm.actionKey}
                onChange={(e) => setRuleForm((p) => ({ ...p, actionKey: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Action Value</label>
              <input
                type="text"
                value={ruleForm.actionValue}
                onChange={(e) => setRuleForm((p) => ({ ...p, actionValue: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>
          </div>
          <button type="submit" className="w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            Agregar regla
          </button>
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
                </div>
                <button
                  onClick={() => handleDeleteCounter(counter.key)}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
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
                  <p className="font-semibold">{rule.when.counterKey} {rule.when.operator} {rule.when.value}</p>
                  <p className="text-xs text-slate-400">acciones: {rule.actions.length}</p>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
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
