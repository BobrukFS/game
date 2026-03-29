"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  fetchLogicEditorBootstrap,
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
import PathTrail from "@/components/editor/PathTrail"

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
  "world_changed",
  "counter_changed",
  "sequence_started",
  "sequence_completed",
  "sequence_paused",
]

const EVENT_FILTER_SUPPORT: Record<RuleTriggerType, { statKey: boolean; worldKey: boolean; counterKey: boolean; deckType: boolean }> = {
  any: { statKey: false, worldKey: false, counterKey: false, deckType: false },
  card_shown: { statKey: false, worldKey: false, counterKey: false, deckType: true },
  option_resolved: { statKey: false, worldKey: false, counterKey: false, deckType: true },
  stat_changed: { statKey: true, worldKey: false, counterKey: false, deckType: false },
  world_changed: { statKey: false, worldKey: true, counterKey: false, deckType: false },
  counter_changed: { statKey: false, worldKey: false, counterKey: true, deckType: false },
  sequence_started: { statKey: false, worldKey: false, counterKey: false, deckType: true },
  sequence_completed: { statKey: false, worldKey: false, counterKey: false, deckType: true },
  sequence_paused: { statKey: false, worldKey: true, counterKey: false, deckType: true },
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

const NUMERIC_RULE_OPERATORS: RuleOperator[] = ["eq", "gt", "gte", "lt", "lte"]

function getConditionOperatorOptions(source: "" | SelectionConditionSource): RuleOperator[] {
  if (!source) return NUMERIC_RULE_OPERATORS
  if (source === "flag") return ["eq"]
  return NUMERIC_RULE_OPERATORS
}

function getDefaultConditionOperator(source: "" | SelectionConditionSource): RuleOperator {
  return getConditionOperatorOptions(source)[0]
}

function normalizeConditionOperator(
  source: "" | SelectionConditionSource,
  operator: RuleOperator
): RuleOperator {
  const options = getConditionOperatorOptions(source)
  return options.includes(operator) ? operator : options[0]
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
    filterCounterKey: "",
    filterDeckType: "",
    actionType: "increment_counter" as
      | "increment_counter"
      | "set_world_state"
      | "increment_world_state"
      | "set_stat"
      | "modify_stat"
      | "step_world_state_option",
    actionKey: "",
    actionValue: "",
    actionOptions: "",
    actionDefaultIndex: 0,
    actionWrap: true,
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
    conditionSource: "" as "" | SelectionConditionSource,
    conditionKey: "",
    conditionOperator: "gte" as RuleOperator,
    conditionValue: "",
    blockCounterKey: "",
    blockCounterOperator: "gte" as RuleOperator,
    blockCounterValue: 1,
    whenCounterKey: "",
    whenCounterOperator: "gte" as RuleOperator,
    whenCounterValue: 1,
  })

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [expandedWeightRuleId, setExpandedWeightRuleId] = useState<string | null>(null)
  const [editingWeightRuleId, setEditingWeightRuleId] = useState<string | null>(null)
  const [weightRuleDraft, setWeightRuleDraft] = useState<SelectionWeightRule | null>(null)
  const [expandedConstraintRuleId, setExpandedConstraintRuleId] = useState<string | null>(null)
  const [editingConstraintRuleId, setEditingConstraintRuleId] = useState<string | null>(null)
  const [constraintRuleDraft, setConstraintRuleDraft] = useState<SelectionConstraintRule | null>(null)

  useEffect(() => {
    void loadLogic()
  }, [gameId])

  async function loadLogic() {
    try {
      setIsLoading(true)
      const bootstrap = await fetchLogicEditorBootstrap(gameId)

      setLogicCounters(bootstrap.counters || [])
      setLogicRules(bootstrap.rules || [])
      setLogicWeightRules(bootstrap.weightRules || [])
      setLogicConstraintRules(bootstrap.constraintRules || [])
      setWorldStateKeys(bootstrap.worldStateKeys || [])
      setStatKeys(bootstrap.statKeys || [])
      setDeckWeights(bootstrap.deckWeights || [])
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
    const actionOptions = ruleForm.actionOptions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    if (!counterKey || !actionKey) {
      setFeedback("Regla incompleta: counter key y action key son obligatorios")
      return
    }

    if (ruleForm.actionType !== "step_world_state_option" && !actionValue) {
      setFeedback("Regla incompleta: action value es obligatorio")
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

    if (ruleForm.trigger === "counter_changed" && !ruleForm.filterCounterKey.trim()) {
      setFeedback("Para evento counter_changed debes definir filtro Counter Key")
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
                : ruleForm.actionType === "modify_stat"
                  ? {
                  type: "modify_stat" as const,
                  key: actionKey,
                  amount: Number(actionValue),
                }
                  : {
                    type: "step_world_state_option" as const,
                    key: actionKey,
                    ...(actionOptions.length > 0 ? { options: actionOptions } : {}),
                    defaultIndex: Number(ruleForm.actionDefaultIndex),
                    amount: Number(actionValue || "1"),
                    wrap: !!ruleForm.actionWrap,
                  }

    if (
      ("amount" in action && !Number.isFinite(action.amount)) ||
      ("value" in action && typeof action.value === "number" && !Number.isFinite(action.value))
    ) {
      setFeedback("Regla invalida: valor numerico incorrecto")
      return
    }

    const rule: InteractionRule = {
      id: editingRuleId || `rule-${Date.now()}`,
      trigger: ruleForm.trigger,
      filters: {
        statKey: ruleForm.filterStatKey.trim() || undefined,
        worldKey: ruleForm.filterWorldKey.trim() || undefined,
        counterKey: ruleForm.filterCounterKey.trim() || undefined,
        deckType: ruleForm.filterDeckType.trim() || undefined,
      },
      when: {
        counterKey,
        operator: ruleForm.operator,
        value: ruleForm.value,
      },
      actions: [action],
    }

    const nextRules = editingRuleId
      ? logicRules.map((existingRule) => (existingRule.id === editingRuleId ? rule : existingRule))
      : [...logicRules, rule]

    await persistLogic(logicCounters, nextRules)
    setRuleForm({
      trigger: "option_resolved",
      counterKey: "",
      operator: "gte",
      value: 1,
      filterStatKey: "",
      filterWorldKey: "",
      filterCounterKey: "",
      filterDeckType: "",
      actionType: "increment_counter",
      actionKey: "",
      actionValue: "",
      actionOptions: "",
      actionDefaultIndex: 0,
      actionWrap: true,
    })
    setEditingRuleId(null)
  }

  function startEditRule(rule: InteractionRule) {
    if (!rule.actions?.length) {
      setFeedback("No se puede editar una regla sin acciones")
      return
    }

    if (rule.actions.length > 1) {
      setFeedback("La edicion desde UI solo soporta reglas con una accion")
      return
    }

    const action = rule.actions[0]
    const actionType = action.type
    const actionKey = action.key
    const actionValue =
      actionType === "increment_counter" || actionType === "increment_world_state" || actionType === "modify_stat"
        ? String(action.amount ?? 1)
        : actionType === "step_world_state_option"
          ? String(action.amount ?? 1)
        : actionType === "set_world_state"
          ? String(action.value)
          : String(action.value)

    setEditingRuleId(rule.id)
    setRuleForm({
      trigger: rule.trigger || "any",
      counterKey: rule.when.counterKey,
      operator: rule.when.operator,
      value: Number(rule.when.value),
      filterStatKey: rule.filters?.statKey || "",
      filterWorldKey: rule.filters?.worldKey || "",
      filterCounterKey: rule.filters?.counterKey || "",
      filterDeckType: rule.filters?.deckType || "",
      actionType,
      actionKey,
      actionValue,
      actionOptions:
        actionType === "step_world_state_option"
          ? (action.options || []).join(", ")
          : "",
      actionDefaultIndex:
        actionType === "step_world_state_option"
          ? Number(action.defaultIndex ?? 0)
          : 0,
      actionWrap:
        actionType === "step_world_state_option"
          ? action.wrap !== false
          : true,
    })
    setFeedback("")
  }

  function cancelEditRule() {
    setEditingRuleId(null)
    setRuleForm({
      trigger: "option_resolved",
      counterKey: "",
      operator: "gte",
      value: 1,
      filterStatKey: "",
      filterWorldKey: "",
      filterCounterKey: "",
      filterDeckType: "",
      actionType: "increment_counter",
      actionKey: "",
      actionValue: "",
      actionOptions: "",
      actionDefaultIndex: 0,
      actionWrap: true,
    })
    setFeedback("")
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
      conditionOperator: getDefaultConditionOperator(""),
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

  function normalizeSelectionConditionValue(
    source: SelectionConditionSource,
    rawValue: string | number | boolean
  ): string | number | boolean {
    if (source === "counter" || source === "stat") {
      const n = Number(rawValue)
      return Number.isFinite(n) ? n : 0
    }

    if (source === "flag") {
      if (typeof rawValue === "boolean") return rawValue
      return String(rawValue).toLowerCase() === "true"
    }

    return String(rawValue)
  }

  function startEditWeightRule(rule: SelectionWeightRule) {
    setExpandedWeightRuleId(rule.id)
    setEditingWeightRuleId(rule.id)
    setWeightRuleDraft(JSON.parse(JSON.stringify(rule)) as SelectionWeightRule)
  }

  function cancelEditWeightRule() {
    setEditingWeightRuleId(null)
    setWeightRuleDraft(null)
  }

  async function saveEditWeightRule() {
    if (!editingWeightRuleId || !weightRuleDraft) return

    const normalizedConditions = (weightRuleDraft.conditions || [])
      .filter((condition) => condition.source && condition.key?.trim())
      .map((condition) => ({
        ...condition,
        key: condition.key.trim(),
        value: normalizeSelectionConditionValue(
          condition.source,
          condition.value as string | number | boolean
        ),
      }))

    const nextRule: SelectionWeightRule = {
      ...weightRuleDraft,
      targetKey: weightRuleDraft.targetKey.trim(),
      value: Number(weightRuleDraft.value),
      conditions: normalizedConditions.length > 0 ? normalizedConditions : undefined,
    }

    if (!nextRule.targetKey) {
      setFeedback("Target key no puede estar vacio")
      return
    }

    if (!Number.isFinite(nextRule.value)) {
      setFeedback("Valor invalido en regla de peso")
      return
    }

    const nextWeightRules = logicWeightRules.map((rule) =>
      rule.id === editingWeightRuleId ? nextRule : rule
    )

    await persistLogic(logicCounters, logicRules, nextWeightRules)
    setEditingWeightRuleId(null)
    setWeightRuleDraft(null)
  }

  async function handleAddConstraintRule(e: React.FormEvent) {
    e.preventDefault()

    const targetKey = constraintRuleForm.targetKey.trim()
    if (!targetKey) {
      setFeedback("La regla de restriccion requiere target key")
      return
    }

    const hasCounterCondition = !!constraintRuleForm.blockCounterKey.trim()
    if (!hasCounterCondition) {
      setFeedback("La regla de restriccion requiere block counter")
      return
    }

    const conditionSource = constraintRuleForm.conditionSource || null

    const hasGenericCondition =
      !!conditionSource &&
      !!constraintRuleForm.conditionKey.trim() &&
      String(constraintRuleForm.conditionValue).trim() !== ""

    const nextConstraintRule: SelectionConstraintRule = {
      id: `constraint-${Date.now()}`,
      targetType: constraintRuleForm.targetType,
      targetKey,
      conditions: hasGenericCondition
        ? [
            {
              source: conditionSource,
              key: constraintRuleForm.conditionKey.trim(),
              operator: constraintRuleForm.conditionOperator,
              value: normalizeSelectionConditionValue(
                conditionSource,
                constraintRuleForm.conditionValue
              ),
            },
          ]
        : undefined,
      counterCondition: hasCounterCondition
        ? {
            counterKey: constraintRuleForm.blockCounterKey.trim(),
            operator: constraintRuleForm.blockCounterOperator,
            value: Number(constraintRuleForm.blockCounterValue),
          }
        : undefined,
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
      conditionSource: "",
      conditionKey: "",
      conditionOperator: getDefaultConditionOperator(""),
      conditionValue: "",
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

  function startEditConstraintRule(rule: SelectionConstraintRule) {
    setExpandedConstraintRuleId(rule.id)
    setEditingConstraintRuleId(rule.id)
    setConstraintRuleDraft(JSON.parse(JSON.stringify(rule)) as SelectionConstraintRule)
  }

  function cancelEditConstraintRule() {
    setEditingConstraintRuleId(null)
    setConstraintRuleDraft(null)
  }

  async function saveEditConstraintRule() {
    if (!editingConstraintRuleId || !constraintRuleDraft) return

    const normalizedConditions = (constraintRuleDraft.conditions || [])
      .filter((condition) => condition.source && condition.key?.trim())
      .map((condition) => ({
        ...condition,
        key: condition.key.trim(),
        value: normalizeSelectionConditionValue(
          condition.source,
          condition.value as string | number | boolean
        ),
      }))

    const normalizedRule: SelectionConstraintRule = {
      ...constraintRuleDraft,
      targetKey: (constraintRuleDraft.targetKey || "").trim(),
      conditions: normalizedConditions.length > 0 ? normalizedConditions : undefined,
      counterCondition: constraintRuleDraft.counterCondition?.counterKey?.trim()
        ? {
            counterKey: constraintRuleDraft.counterCondition.counterKey.trim(),
            operator: constraintRuleDraft.counterCondition.operator,
            value: Number(constraintRuleDraft.counterCondition.value),
          }
        : undefined,
      whenCounter: constraintRuleDraft.whenCounter?.counterKey?.trim()
        ? {
            counterKey: constraintRuleDraft.whenCounter.counterKey.trim(),
            operator: constraintRuleDraft.whenCounter.operator,
            value: Number(constraintRuleDraft.whenCounter.value),
          }
        : undefined,
    }

    if (!normalizedRule.targetKey) {
      setFeedback("Target key no puede estar vacio")
      return
    }

    const hasCounterCondition =
      !!normalizedRule.counterCondition && Number.isFinite(normalizedRule.counterCondition.value)
    if (!hasCounterCondition) {
      setFeedback("La regla requiere counterCondition")
      return
    }

    const nextConstraintRules = logicConstraintRules.map((rule) =>
      rule.id === editingConstraintRuleId ? normalizedRule : rule
    )

    await persistLogic(logicCounters, logicRules, logicWeightRules, nextConstraintRules)
    setEditingConstraintRuleId(null)
    setConstraintRuleDraft(null)
  }

  const sortedDeckWeights = useMemo(() => {
    const next = [...deckWeights]
    next.sort((left, right) => {
      if (left.weight !== right.weight) return right.weight - left.weight
      return left.id.localeCompare(right.id)
    })
    return next
  }, [deckWeights])

  const totalDeckWeight = useMemo(
    () => deckWeights.reduce((sum, deck) => sum + deck.weight, 0),
    [deckWeights]
  )

  const deckTypeOptions = useMemo(
    () => Array.from(new Set(deckWeights.map((deck) => deck.type).filter(Boolean))).sort(),
    [deckWeights]
  )
  const isDeckWeightTarget =
    weightRuleForm.targetType === "deck_id" ||
    weightRuleForm.targetType === "deck_type"

  const weightTargetOptions = useMemo(
    () =>
      weightRuleForm.targetType === "deck_id"
        ? sortedDeckWeights.map((deck) => ({ key: deck.id, label: `${deck.name} (${deck.id.slice(0, 8)})` }))
        : deckTypeOptions.map((type) => ({ key: type, label: type })),
    [weightRuleForm.targetType, sortedDeckWeights, deckTypeOptions]
  )

  const isDeckConstraintTarget =
    constraintRuleForm.targetType === "deck_id" ||
    constraintRuleForm.targetType === "deck_type"

  const constraintTargetOptions = useMemo(
    () =>
      constraintRuleForm.targetType === "deck_id"
        ? sortedDeckWeights.map((deck) => ({ key: deck.id, label: `${deck.name} (${deck.id.slice(0, 8)})` }))
        : deckTypeOptions.map((type) => ({ key: type, label: type })),
    [constraintRuleForm.targetType, sortedDeckWeights, deckTypeOptions]
  )

  const weightConditionOperatorOptions = getConditionOperatorOptions(weightRuleForm.conditionSource)
  const constraintConditionOperatorOptions = getConditionOperatorOptions(constraintRuleForm.conditionSource)

  const supportsStatFilter = EVENT_FILTER_SUPPORT[ruleForm.trigger]?.statKey
  const supportsWorldFilter = EVENT_FILTER_SUPPORT[ruleForm.trigger]?.worldKey
  const supportsCounterFilter = EVENT_FILTER_SUPPORT[ruleForm.trigger]?.counterKey
  const supportsDeckTypeFilter = EVENT_FILTER_SUPPORT[ruleForm.trigger]?.deckType

  const actionKeyOptions = useMemo(() => {
    if (ruleForm.actionType === "increment_counter") {
      return logicCounters.map((counter) => counter.key)
    }

    if (ruleForm.actionType === "set_stat" || ruleForm.actionType === "modify_stat") {
      return statKeys
    }

    return worldStateKeys
  }, [ruleForm.actionType, logicCounters, statKeys, worldStateKeys])

  const isCustomActionKey = !!ruleForm.actionKey && !actionKeyOptions.includes(ruleForm.actionKey)

  if (isLoading) return <div className="p-8">Cargando...</div>

  return (
    <div className="max-w-5xl p-8 space-y-8">
      <div>
        <PathTrail
          items={[
            { label: "Editor", href: "/editor" },
            { label: "Game Logic" },
          ]}
        />
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
              <option value="card_type">card_type</option>
              <option value="card_id">card_id</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Target Key</label>
            {isDeckWeightTarget ? (
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
            ) : (
              <input
                type="text"
                value={weightRuleForm.targetKey}
                onChange={(e) => setWeightRuleForm((prev) => ({ ...prev, targetKey: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                placeholder={weightRuleForm.targetType === "card_id" ? "card id" : "card type"}
                required
              />
            )}
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
              onChange={(e) => {
                const nextSource = e.target.value as "" | SelectionConditionSource
                setWeightRuleForm((prev) => ({
                  ...prev,
                  conditionSource: nextSource,
                  conditionKey: "",
                  conditionOperator: getDefaultConditionOperator(nextSource),
                  conditionValue: "",
                }))
              }}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="">Sin condicion</option>
              <option value="counter">counter</option>
              <option value="stat">stat</option>
              <option value="world">world</option>
              <option value="flag">flag</option>
              <option value="deck">deck</option>
              <option value="card">card</option>
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
              disabled={!weightRuleForm.conditionSource || !weightRuleForm.conditionKey.trim()}
            >
              {weightConditionOperatorOptions.map((operator) => (
                <option key={operator} value={operator}>{operator}</option>
              ))}
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
              <div key={rule.id} className="rounded bg-slate-700/50 p-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedWeightRuleId((prev) => (prev === rule.id ? null : rule.id))
                  }
                  className="w-full text-left"
                >
                  <p className="text-sm font-semibold">{rule.targetType}:{rule.targetKey} · {rule.operation} {rule.value}</p>
                  {rule.conditions && rule.conditions.length > 0 ? (
                    <p className="text-xs text-slate-400">
                      condiciones: {rule.conditions.length}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-300">sin condiciones genericas</p>
                  )}
                </button>

                {expandedWeightRuleId === rule.id && (
                  <div className="mt-3 space-y-3 border-t border-slate-600 pt-3">
                    {editingWeightRuleId === rule.id && weightRuleDraft ? (
                      <>
                        <div className="grid gap-2 md:grid-cols-2">
                          <select
                            value={weightRuleDraft.targetType}
                            onChange={(e) =>
                              setWeightRuleDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      targetType: e.target.value as SelectionWeightTargetType,
                                    }
                                  : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                          >
                            <option value="deck_type">deck_type</option>
                            <option value="deck_id">deck_id</option>
                            <option value="card_type">card_type</option>
                            <option value="card_id">card_id</option>
                          </select>
                          <input
                            type="text"
                            value={weightRuleDraft.targetKey}
                            onChange={(e) =>
                              setWeightRuleDraft((prev) =>
                                prev ? { ...prev, targetKey: e.target.value } : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                            placeholder="target key"
                          />
                          <select
                            value={weightRuleDraft.operation}
                            onChange={(e) =>
                              setWeightRuleDraft((prev) =>
                                prev
                                  ? { ...prev, operation: e.target.value as "add" | "multiply" | "set" }
                                  : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                          >
                            <option value="multiply">multiply</option>
                            <option value="add">add</option>
                            <option value="set">set</option>
                          </select>
                          <input
                            type="number"
                            step="0.1"
                            value={weightRuleDraft.value}
                            onChange={(e) =>
                              setWeightRuleDraft((prev) =>
                                prev ? { ...prev, value: Number(e.target.value) } : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                          />
                        </div>

                        <div className="space-y-2 rounded bg-slate-900/50 p-2">
                          <p className="text-xs font-semibold text-slate-300">Condiciones</p>
                          {(weightRuleDraft.conditions || []).length === 0 && (
                            <p className="text-xs text-slate-400">Sin condiciones.</p>
                          )}
                          {(weightRuleDraft.conditions || []).map((condition, index) => (
                            <div key={`${rule.id}-cond-${index}`} className="grid gap-2 md:grid-cols-5">
                              <select
                                value={condition.source}
                                onChange={(e) =>
                                  setWeightRuleDraft((prev) => {
                                    if (!prev) return prev
                                    const nextConditions = [...(prev.conditions || [])]
                                    const nextSource = e.target.value as SelectionConditionSource
                                    nextConditions[index] = {
                                      ...nextConditions[index],
                                      source: nextSource,
                                      operator: normalizeConditionOperator(
                                        nextSource,
                                        nextConditions[index].operator
                                      ),
                                    }
                                    return { ...prev, conditions: nextConditions }
                                  })
                                }
                                className="rounded bg-slate-700 px-2 py-2 text-white"
                              >
                                <option value="counter">counter</option>
                                <option value="stat">stat</option>
                                <option value="world">world</option>
                                <option value="flag">flag</option>
                                <option value="deck">deck</option>
                                <option value="card">card</option>
                              </select>
                              <input
                                type="text"
                                value={condition.key}
                                onChange={(e) =>
                                  setWeightRuleDraft((prev) => {
                                    if (!prev) return prev
                                    const nextConditions = [...(prev.conditions || [])]
                                    nextConditions[index] = {
                                      ...nextConditions[index],
                                      key: e.target.value,
                                    }
                                    return { ...prev, conditions: nextConditions }
                                  })
                                }
                                className="rounded bg-slate-700 px-2 py-2 text-white"
                                placeholder="key"
                              />
                              <select
                                value={condition.operator}
                                onChange={(e) =>
                                  setWeightRuleDraft((prev) => {
                                    if (!prev) return prev
                                    const nextConditions = [...(prev.conditions || [])]
                                    nextConditions[index] = {
                                      ...nextConditions[index],
                                      operator: e.target.value as RuleOperator,
                                    }
                                    return { ...prev, conditions: nextConditions }
                                  })
                                }
                                className="rounded bg-slate-700 px-2 py-2 text-white"
                                disabled={!condition.key?.trim()}
                              >
                                {getConditionOperatorOptions(condition.source).map((operator) => (
                                  <option key={operator} value={operator}>{operator}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={String(condition.value)}
                                onChange={(e) =>
                                  setWeightRuleDraft((prev) => {
                                    if (!prev) return prev
                                    const nextConditions = [...(prev.conditions || [])]
                                    nextConditions[index] = {
                                      ...nextConditions[index],
                                      value: e.target.value,
                                    }
                                    return { ...prev, conditions: nextConditions }
                                  })
                                }
                                className="rounded bg-slate-700 px-2 py-2 text-white"
                                placeholder="value"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setWeightRuleDraft((prev) => {
                                    if (!prev) return prev
                                    const nextConditions = [...(prev.conditions || [])]
                                    nextConditions.splice(index, 1)
                                    return { ...prev, conditions: nextConditions }
                                  })
                                }
                                className="rounded bg-red-700 px-2 py-2 text-xs text-white hover:bg-red-800"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setWeightRuleDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      conditions: [
                                        ...(prev.conditions || []),
                                        {
                                          source: "counter",
                                          key: "",
                                          operator: "eq",
                                          value: 0,
                                        },
                                      ],
                                    }
                                  : prev
                              )
                            }
                            className="rounded bg-slate-600 px-3 py-1 text-xs text-white hover:bg-slate-500"
                          >
                            + Condicion
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEditWeightRule()}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditWeightRule}
                            className="rounded bg-slate-600 px-3 py-1 text-xs text-white hover:bg-slate-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1 text-xs text-slate-300">
                          {(rule.conditions || []).length > 0 ? (
                            (rule.conditions || []).map((condition, index) => (
                              <p key={`${rule.id}-view-cond-${index}`}>
                                {index + 1}. {condition.source}:{condition.key} {condition.operator} {String(condition.value)}
                              </p>
                            ))
                          ) : (
                            <p>Sin condiciones.</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditWeightRule(rule)}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                          >
                            Editar
                          </button>
                          <button onClick={() => void handleDeleteWeightRule(rule.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded bg-slate-800 p-4 space-y-4">
        <div>
          <h2 className="font-semibold">Reglas de restriccion (hard constraints)</h2>
          <p className="text-sm text-slate-400 mt-1">Bloquean candidatos por selector con condiciones genericas opcionales, counters de bloqueo y limites de ocurrencia.</p>
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
              <option value="card_type">card_type</option>
              <option value="card_id">card_id</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Target Key</label>
            {isDeckConstraintTarget ? (
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
            ) : (
              <input
                type="text"
                value={constraintRuleForm.targetKey}
                onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, targetKey: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                placeholder={constraintRuleForm.targetType === "card_id" ? "card id" : "card type"}
                required
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Condicion Source (opcional)</label>
            <select
              value={constraintRuleForm.conditionSource}
              onChange={(e) =>
                {
                  const nextSource = e.target.value as "" | SelectionConditionSource
                  setConstraintRuleForm((prev) => ({
                    ...prev,
                    conditionSource: nextSource,
                    conditionKey: "",
                    conditionValue: "",
                    conditionOperator: getDefaultConditionOperator(nextSource),
                  }))
                }
              }
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="">Sin condicion adicional</option>
              <option value="counter">counter</option>
              <option value="stat">stat</option>
              <option value="world">world</option>
              <option value="flag">flag</option>
              <option value="deck">deck</option>
              <option value="card">card</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Condicion Key</label>
            <input
              type="text"
              value={constraintRuleForm.conditionKey}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, conditionKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!constraintRuleForm.conditionSource}
              placeholder={
                constraintRuleForm.conditionSource === "deck"
                  ? "type, repeatable, id..."
                  : constraintRuleForm.conditionSource === "card"
                    ? "type, priority, id..."
                    : "key"
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={constraintRuleForm.conditionOperator}
              onChange={(e) =>
                setConstraintRuleForm((prev) => ({
                  ...prev,
                  conditionOperator: e.target.value as RuleOperator,
                }))
              }
              className="rounded bg-slate-700 px-4 py-2 text-white"
              disabled={!constraintRuleForm.conditionSource || !constraintRuleForm.conditionKey.trim()}
            >
              {constraintConditionOperatorOptions.map((operator) => (
                <option key={operator} value={operator}>{operator}</option>
              ))}
            </select>
            {constraintRuleForm.conditionSource === "flag" ? (
              <select
                value={String(constraintRuleForm.conditionValue || "")}
                onChange={(e) =>
                  setConstraintRuleForm((prev) => ({
                    ...prev,
                    conditionValue: e.target.value,
                  }))
                }
                className="rounded bg-slate-700 px-4 py-2 text-white"
                disabled={!constraintRuleForm.conditionSource}
              >
                <option value="">valor</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type={
                  constraintRuleForm.conditionSource === "counter" ||
                  constraintRuleForm.conditionSource === "stat"
                    ? "number"
                    : "text"
                }
                value={String(constraintRuleForm.conditionValue || "")}
                onChange={(e) =>
                  setConstraintRuleForm((prev) => ({
                    ...prev,
                    conditionValue: e.target.value,
                  }))
                }
                className="rounded bg-slate-700 px-4 py-2 text-white"
                disabled={!constraintRuleForm.conditionSource}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Block Counter Key</label>
            <select
              value={constraintRuleForm.blockCounterKey}
              onChange={(e) => setConstraintRuleForm((prev) => ({ ...prev, blockCounterKey: e.target.value }))}
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
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
              <div key={rule.id} className="rounded bg-slate-700/50 p-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedConstraintRuleId((prev) => (prev === rule.id ? null : rule.id))
                  }
                  className="w-full text-left"
                >
                  <p className="text-sm font-semibold">{rule.targetType}:{rule.targetKey}</p>
                  <p className="text-xs text-slate-400">
                    {(rule.conditions || []).length > 0
                      ? `cond: ${(rule.conditions || []).map((c) => `${c.source}:${c.key} ${c.operator} ${String(c.value)}`).join(" && ")}`
                      : "sin condiciones"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {rule.counterCondition
                      ? `bloquea: ${rule.counterCondition.counterKey} ${rule.counterCondition.operator} ${rule.counterCondition.value}`
                      : "sin counterCondition"}
                  </p>
                </button>

                {expandedConstraintRuleId === rule.id && (
                  <div className="mt-3 space-y-3 border-t border-slate-600 pt-3">
                    {editingConstraintRuleId === rule.id && constraintRuleDraft ? (
                      <>
                        <div className="grid gap-2 md:grid-cols-2">
                          <select
                            value={constraintRuleDraft.targetType}
                            onChange={(e) =>
                              setConstraintRuleDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      targetType: e.target.value as SelectionWeightTargetType,
                                    }
                                  : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                          >
                            <option value="deck_type">deck_type</option>
                            <option value="deck_id">deck_id</option>
                            <option value="card_type">card_type</option>
                            <option value="card_id">card_id</option>
                          </select>
                          <input
                            type="text"
                            value={constraintRuleDraft.targetKey}
                            onChange={(e) =>
                              setConstraintRuleDraft((prev) =>
                                prev ? { ...prev, targetKey: e.target.value } : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                            placeholder="target key"
                          />

                          <div className="space-y-2 md:col-span-2">
                            <p className="text-xs text-slate-300">Condiciones (todas deben cumplirse)</p>
                            {(constraintRuleDraft.conditions || []).map((condition, index) => (
                              <div key={`${constraintRuleDraft.id}-constraint-cond-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                                <select
                                  value={condition.source}
                                  onChange={(e) =>
                                    setConstraintRuleDraft((prev) => {
                                      if (!prev) return prev
                                      const nextConditions = [...(prev.conditions || [])]
                                      const nextSource = e.target.value as SelectionConditionSource
                                      nextConditions[index] = {
                                        ...nextConditions[index],
                                        source: nextSource,
                                        operator: normalizeConditionOperator(
                                          nextSource,
                                          nextConditions[index].operator
                                        ),
                                      }
                                      return { ...prev, conditions: nextConditions }
                                    })
                                  }
                                  className="rounded bg-slate-700 px-3 py-2 text-white"
                                >
                                  <option value="counter">counter</option>
                                  <option value="stat">stat</option>
                                  <option value="world">world</option>
                                  <option value="flag">flag</option>
                                  <option value="deck">deck</option>
                                  <option value="card">card</option>
                                </select>
                                <input
                                  type="text"
                                  value={condition.key}
                                  onChange={(e) =>
                                    setConstraintRuleDraft((prev) => {
                                      if (!prev) return prev
                                      const nextConditions = [...(prev.conditions || [])]
                                      nextConditions[index] = {
                                        ...nextConditions[index],
                                        key: e.target.value,
                                      }
                                      return { ...prev, conditions: nextConditions }
                                    })
                                  }
                                  className="rounded bg-slate-700 px-3 py-2 text-white"
                                  placeholder="key"
                                />
                                <select
                                  value={condition.operator}
                                  onChange={(e) =>
                                    setConstraintRuleDraft((prev) => {
                                      if (!prev) return prev
                                      const nextConditions = [...(prev.conditions || [])]
                                      nextConditions[index] = {
                                        ...nextConditions[index],
                                        operator: e.target.value as RuleOperator,
                                      }
                                      return { ...prev, conditions: nextConditions }
                                    })
                                  }
                                  className="rounded bg-slate-700 px-3 py-2 text-white"
                                  disabled={!condition.key?.trim()}
                                >
                                  {getConditionOperatorOptions(condition.source).map((operator) => (
                                    <option key={operator} value={operator}>{operator}</option>
                                  ))}
                                </select>
                                <input
                                  type={condition.source === "counter" || condition.source === "stat" ? "number" : "text"}
                                  value={String(condition.value ?? "")}
                                  onChange={(e) =>
                                    setConstraintRuleDraft((prev) => {
                                      if (!prev) return prev
                                      const nextConditions = [...(prev.conditions || [])]
                                      nextConditions[index] = {
                                        ...nextConditions[index],
                                        value: e.target.value,
                                      }
                                      return { ...prev, conditions: nextConditions }
                                    })
                                  }
                                  className="rounded bg-slate-700 px-3 py-2 text-white"
                                  placeholder="valor"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConstraintRuleDraft((prev) => {
                                      if (!prev) return prev
                                      const nextConditions = [...(prev.conditions || [])]
                                      nextConditions.splice(index, 1)
                                      return {
                                        ...prev,
                                        conditions: nextConditions.length > 0 ? nextConditions : undefined,
                                      }
                                    })
                                  }
                                  className="rounded bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-700"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() =>
                                setConstraintRuleDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        conditions: [
                                          ...(prev.conditions || []),
                                          {
                                            source: "counter",
                                            key: "",
                                            operator: "eq",
                                            value: 0,
                                          },
                                        ],
                                      }
                                    : prev
                                )
                              }
                              className="rounded bg-slate-600 px-3 py-1 text-xs text-white hover:bg-slate-500"
                            >
                              + Condicion
                            </button>
                          </div>

                          <input
                            type="text"
                            value={constraintRuleDraft.counterCondition?.counterKey || ""}
                            onChange={(e) =>
                              setConstraintRuleDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      counterCondition: {
                                        counterKey: e.target.value,
                                        operator: prev.counterCondition?.operator || "gte",
                                        value: Number(prev.counterCondition?.value || 1),
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                            placeholder="block counter key"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={constraintRuleDraft.counterCondition?.operator || "gte"}
                              onChange={(e) =>
                                setConstraintRuleDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        counterCondition: {
                                          counterKey: prev.counterCondition?.counterKey || "",
                                          operator: e.target.value as RuleOperator,
                                          value: Number(prev.counterCondition?.value || 1),
                                        },
                                      }
                                    : prev
                                )
                              }
                              className="rounded bg-slate-700 px-3 py-2 text-white"
                            >
                              <option value="eq">eq</option>
                              <option value="gt">gt</option>
                              <option value="gte">gte</option>
                              <option value="lt">lt</option>
                              <option value="lte">lte</option>
                            </select>
                            <input
                              type="number"
                              value={Number(constraintRuleDraft.counterCondition?.value || 1)}
                              onChange={(e) =>
                                setConstraintRuleDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        counterCondition: {
                                          counterKey: prev.counterCondition?.counterKey || "",
                                          operator: prev.counterCondition?.operator || "gte",
                                          value: Number(e.target.value),
                                        },
                                      }
                                    : prev
                                )
                              }
                              className="rounded bg-slate-700 px-3 py-2 text-white"
                            />
                          </div>

                          <input
                            type="text"
                            value={constraintRuleDraft.whenCounter?.counterKey || ""}
                            onChange={(e) =>
                              setConstraintRuleDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      whenCounter: e.target.value
                                        ? {
                                            counterKey: e.target.value,
                                            operator: prev.whenCounter?.operator || "gte",
                                            value: Number(prev.whenCounter?.value || 1),
                                          }
                                        : undefined,
                                    }
                                  : prev
                              )
                            }
                            className="rounded bg-slate-700 px-3 py-2 text-white"
                            placeholder="when counter key (opcional)"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={constraintRuleDraft.whenCounter?.operator || "gte"}
                              onChange={(e) =>
                                setConstraintRuleDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        whenCounter: prev.whenCounter
                                          ? {
                                              ...prev.whenCounter,
                                              operator: e.target.value as RuleOperator,
                                            }
                                          : undefined,
                                      }
                                    : prev
                                )
                              }
                              className="rounded bg-slate-700 px-3 py-2 text-white"
                              disabled={!constraintRuleDraft.whenCounter}
                            >
                              <option value="eq">eq</option>
                              <option value="gt">gt</option>
                              <option value="gte">gte</option>
                              <option value="lt">lt</option>
                              <option value="lte">lte</option>
                            </select>
                            <input
                              type="number"
                              value={Number(constraintRuleDraft.whenCounter?.value || 1)}
                              onChange={(e) =>
                                setConstraintRuleDraft((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        whenCounter: prev.whenCounter
                                          ? {
                                              ...prev.whenCounter,
                                              value: Number(e.target.value),
                                            }
                                          : undefined,
                                      }
                                    : prev
                                )
                              }
                              className="rounded bg-slate-700 px-3 py-2 text-white"
                              disabled={!constraintRuleDraft.whenCounter}
                            />
                          </div>

                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEditConstraintRule()}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditConstraintRule}
                            className="rounded bg-slate-600 px-3 py-1 text-xs text-white hover:bg-slate-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1 text-xs text-slate-300">
                          {(rule.conditions || []).length > 0 ? (
                            (rule.conditions || []).map((condition, index) => (
                              <p key={`${rule.id}-constraint-view-cond-${index}`}>
                                {index + 1}. {condition.source}:{condition.key} {condition.operator} {String(condition.value)}
                              </p>
                            ))
                          ) : (
                            <p>Sin condiciones.</p>
                          )}
                          {rule.counterCondition ? (
                            <p>
                              bloquea: {rule.counterCondition.counterKey} {rule.counterCondition.operator} {rule.counterCondition.value}
                            </p>
                          ) : (
                            <p>Sin counterCondition.</p>
                          )}
                          {rule.whenCounter && (
                            <p>
                              when: {rule.whenCounter.counterKey} {rule.whenCounter.operator} {rule.whenCounter.value}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditConstraintRule(rule)}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                          >
                            Editar
                          </button>
                          <button onClick={() => void handleDeleteConstraintRule(rule.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">
                            Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
          <h2 className="font-semibold">{editingRuleId ? "Editar Regla" : "Nueva Regla"}</h2>
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

          {(supportsStatFilter || supportsWorldFilter || supportsCounterFilter || supportsDeckTypeFilter) && (
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
              {supportsCounterFilter && (
                <div>
                  <label className="mb-1 block text-sm font-semibold">Filtro Counter Key</label>
                  <select
                    value={ruleForm.filterCounterKey}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, filterCounterKey: e.target.value }))}
                    className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                  >
                    <option value="">Selecciona counter</option>
                    {logicCounters.map((counter) => (
                      <option key={counter.key} value={counter.key}>{counter.key}</option>
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
              {supportsDeckTypeFilter && (
                <div>
                  <label className="mb-1 block text-sm font-semibold">Filtro Deck Type (opcional)</label>
                  <select
                    value={ruleForm.filterDeckType}
                    onChange={(e) => setRuleForm((prev) => ({ ...prev, filterDeckType: e.target.value }))}
                    className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                  >
                    <option value="">Sin filtro</option>
                    {deckTypeOptions.map((type) => (
                      <option key={type} value={type}>{type}</option>
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
                    | "modify_stat"
                    | "step_world_state_option",
                }))
              }
              className="w-full rounded bg-slate-700 px-4 py-2 text-white"
            >
              <option value="increment_counter">increment_counter</option>
              <option value="set_world_state">set_world_state</option>
              <option value="increment_world_state">increment_world_state</option>
              <option value="set_stat">set_stat</option>
              <option value="modify_stat">modify_stat</option>
              <option value="step_world_state_option">step_world_state_option</option>
            </select>
          </div>

          {ruleForm.actionType === "step_world_state_option" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold">Opciones (coma separadas, opcional)</label>
                <input
                  type="text"
                  value={ruleForm.actionOptions}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, actionOptions: e.target.value }))}
                  className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                  placeholder="Si lo dejas vacio, usa opciones del world state enum"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">Index default</label>
                <input
                  type="number"
                  value={ruleForm.actionDefaultIndex}
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      actionDefaultIndex: Number(e.target.value),
                    }))
                  }
                  className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <input
                  id="action-wrap"
                  type="checkbox"
                  checked={ruleForm.actionWrap}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, actionWrap: e.target.checked }))}
                />
                <label htmlFor="action-wrap" className="text-sm text-slate-300">
                  Wrap circular (si no, clamp al inicio/final)
                </label>
              </div>
            </div>
          )}

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
              <label className="mb-1 block text-sm font-semibold">
                {ruleForm.actionType === "step_world_state_option" ? "Step (+/-)" : "Action Value"}
              </label>
              <input
                type={ruleForm.actionType === "step_world_state_option" ? "number" : "text"}
                value={ruleForm.actionValue}
                onChange={(e) => setRuleForm((prev) => ({ ...prev, actionValue: e.target.value }))}
                className="w-full rounded bg-slate-700 px-4 py-2 text-white"
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
              {editingRuleId ? "Guardar cambios" : "Agregar regla"}
            </button>
            {editingRuleId && (
              <button
                type="button"
                onClick={cancelEditRule}
                className="rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-500"
              >
                Cancelar
              </button>
            )}
          </div>
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
                  {(rule.filters?.statKey || rule.filters?.worldKey || rule.filters?.counterKey || rule.filters?.deckType) && (
                    <p className="text-xs text-slate-400">
                      filtros:
                      {rule.filters?.statKey ? ` stat=${rule.filters.statKey}` : ""}
                      {rule.filters?.worldKey ? ` world=${rule.filters.worldKey}` : ""}
                      {rule.filters?.counterKey ? ` counter=${rule.filters.counterKey}` : ""}
                      {rule.filters?.deckType ? ` deckType=${rule.filters.deckType}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">acciones: {rule.actions.length}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditRule(rule)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => void handleDeleteRule(rule.id)}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
