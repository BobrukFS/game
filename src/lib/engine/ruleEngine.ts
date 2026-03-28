import { GameLogicConfig, GameRuleAction, InteractionRule, RuleOperator, RuleTriggerType } from "@/lib/domain"
import { GameState } from "@/lib/domain/gameState"

export interface RuntimeRuleEvent {
  type: RuleTriggerType
  cardId?: string
  optionId?: string
  statKey?: string
  worldKey?: string
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

export function applyGameLogicEvent(
  state: GameState,
  config: GameLogicConfig | undefined,
  event: RuntimeRuleEvent
): GameState {
  const normalized = normalizeInteractionState(state)
  if (!config) return normalized

  let nextState = normalized
  for (const rule of config.rules || []) {
    if (!ruleMatchesEvent(rule, event)) continue
    if (!ruleMatchesCounterCondition(rule, nextState)) continue

    for (const action of rule.actions || []) {
      nextState = applyRuleAction(nextState, action)
    }
  }

  return nextState
}

export function applyGameLogicEvents(
  state: GameState,
  config: GameLogicConfig | undefined,
  events: RuntimeRuleEvent[]
): GameState {
  let nextState = normalizeInteractionState(state)
  for (const event of events) {
    nextState = applyGameLogicEvent(nextState, config, event)
  }
  return nextState
}
