import { GameLogicConfig, GameRuleAction, InteractionRule, RuleOperator, RuleTriggerType } from "@/lib/domain"
import { GameState } from "@/lib/domain/gameState"

export interface RuntimeRuleEvent {
  type: RuleTriggerType
  cardId?: string
  optionId?: string
  statKey?: string
  worldKey?: string
  counterKey?: string
}

export interface RuntimeRuleTraceEntry {
  event: RuntimeRuleEvent
  source: "input" | "action"
  viaRuleId?: string
  viaActionType?: GameRuleAction["type"]
}

interface QueuedRuntimeRuleEvent {
  event: RuntimeRuleEvent
  source: "input" | "action"
  viaRuleId?: string
  viaActionType?: GameRuleAction["type"]
}

function compareValues(left: number, operator: RuleOperator, right: number) {
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

function normalizeInteractionState(state: GameState): GameState {
  const counters = { ...(state.interactions?.counters || {}) }
  const total = Number.isFinite(state.interactions?.total)
    ? (state.interactions?.total as number)
    : Number(counters["interactions.total"] || 0)

  return {
    ...state,
    interactions: {
      total,
      counters,
    },
  }
}

function ruleMatchesEvent(rule: InteractionRule, event: RuntimeRuleEvent) {
  const trigger = rule.trigger || "any"
  if (trigger !== "any" && trigger !== event.type) return false

  const filters = rule.filters
  if (!filters) return true

  if (filters.statKey && filters.statKey !== event.statKey) return false
  if (filters.worldKey && filters.worldKey !== event.worldKey) return false
  if (filters.counterKey && filters.counterKey !== event.counterKey) return false
  if (filters.cardId && filters.cardId !== event.cardId) return false
  if (filters.optionId && filters.optionId !== event.optionId) return false

  return true
}

function ruleMatchesCounterCondition(rule: InteractionRule, state: GameState) {
  const current = Number(state.interactions?.counters?.[rule.when.counterKey] || 0)
  return compareValues(current, rule.when.operator, rule.when.value)
}

function applyRuleAction(state: GameState, action: GameRuleAction) {
  const nextState = normalizeInteractionState(state)

  switch (action.type) {
    case "increment_counter": {
      const amount = Number(action.amount ?? 1)
      if (!Number.isFinite(amount)) return nextState

      const counters = {
        ...nextState.interactions!.counters,
        [action.key]: Number(nextState.interactions!.counters[action.key] || 0) + amount,
      }
      const total =
        action.key === "interactions.total"
          ? counters[action.key]
          : Number(counters["interactions.total"] || nextState.interactions!.total)

      return {
        ...nextState,
        interactions: {
          total,
          counters,
        },
      }
    }
    case "set_world_state":
      return {
        ...nextState,
        world: {
          ...nextState.world,
          [action.key]: action.value,
        },
      }
    case "increment_world_state": {
      const current = Number(nextState.world[action.key] || 0)
      return {
        ...nextState,
        world: {
          ...nextState.world,
          [action.key]: current + action.amount,
        },
      }
    }
    case "set_stat":
      return {
        ...nextState,
        stats: {
          ...nextState.stats,
          [action.key]: action.value,
        },
      }
    case "modify_stat":
      return {
        ...nextState,
        stats: {
          ...nextState.stats,
          [action.key]: Number(nextState.stats[action.key] || 0) + action.amount,
        },
      }
    default:
      return nextState
  }
}

function applyRuleActionWithEvents(
  state: GameState,
  action: GameRuleAction,
  eventQueue: QueuedRuntimeRuleEvent[],
  sourceRuleId: string
) {
  const nextState = applyRuleAction(state, action)

  if (action.type === "increment_counter") {
    eventQueue.push({
      event: {
        type: "counter_changed",
        counterKey: action.key,
      },
      source: "action",
      viaRuleId: sourceRuleId,
      viaActionType: action.type,
    })
  }

  return nextState
}

export function applyGameLogicEvent(
  state: GameState,
  config: GameLogicConfig | undefined,
  event: RuntimeRuleEvent,
  traceCollector?: RuntimeRuleTraceEntry[]
): GameState {
  const normalized = normalizeInteractionState(state)
  if (!config) return normalized

  const rules = config.rules || []
  if (rules.length === 0) return normalized

  let nextState = normalized
  const eventQueue: QueuedRuntimeRuleEvent[] = [
    {
      event,
      source: "input",
    },
  ]
  let processedEvents = 0
  const MAX_RULE_EVENTS = 100

  while (eventQueue.length > 0 && processedEvents < MAX_RULE_EVENTS) {
    const currentEvent = eventQueue.shift()!
    processedEvents += 1

    traceCollector?.push({
      event: currentEvent.event,
      source: currentEvent.source,
      viaRuleId: currentEvent.viaRuleId,
      viaActionType: currentEvent.viaActionType,
    })

    for (const rule of rules) {
      if (!ruleMatchesEvent(rule, currentEvent.event)) continue
      if (!ruleMatchesCounterCondition(rule, nextState)) continue

      for (const action of rule.actions || []) {
        nextState = applyRuleActionWithEvents(nextState, action, eventQueue, rule.id)
      }
    }
  }

  if (processedEvents >= MAX_RULE_EVENTS) {
    console.warn("Rule engine reached max event iterations. Possible recursive rule loop.")
  }

  return nextState
}

export function applyGameLogicEvents(
  state: GameState,
  config: GameLogicConfig | undefined,
  events: RuntimeRuleEvent[],
  traceCollector?: RuntimeRuleTraceEntry[]
): GameState {
  let nextState = normalizeInteractionState(state)
  for (const event of events) {
    nextState = applyGameLogicEvent(nextState, config, event, traceCollector)
  }
  return nextState
}
