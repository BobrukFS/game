import { WorldStateValue } from "./gameState"

export type InteractionScope = "global" | "deck" | "card"

export interface InteractionCounterConfig {
  key: string
  scope: InteractionScope
  description?: string
}

export type RuleOperator = "eq" | "gt" | "gte" | "lt" | "lte"

export type RuleTriggerType =
  | "any"
  | "card_shown"
  | "option_resolved"
  | "stat_changed"
  | "sequence_started"
  | "sequence_completed"
  | "sequence_paused"

export interface InteractionRuleCondition {
  counterKey: string
  operator: RuleOperator
  value: number
}

export interface InteractionRuleFilters {
  statKey?: string
  worldKey?: string
  cardId?: string
  optionId?: string
}

export type GameRuleAction =
  | {
      type: "increment_counter"
      key: string
      amount?: number
    }
  | {
      type: "set_world_state"
      key: string
      value: WorldStateValue
    }
  | {
      type: "increment_world_state"
      key: string
      amount: number
    }
  | {
      type: "set_stat"
      key: string
      value: number
    }
  | {
      type: "modify_stat"
      key: string
      amount: number
    }

export interface InteractionRule {
  id: string
  trigger?: RuleTriggerType
  filters?: InteractionRuleFilters
  when: InteractionRuleCondition
  actions: GameRuleAction[]
}

export type SelectionWeightTargetType = "deck_id" | "deck_type"

export type SelectionWeightOperation = "add" | "multiply" | "set"

export type SelectionConditionSource = "counter" | "stat" | "world" | "flag"

export interface SelectionCondition {
  source: SelectionConditionSource
  key: string
  operator: RuleOperator
  value: number | string | boolean
}

export interface SelectionWeightRuleFilters {
  phase?: string
  context?: string
  dayMin?: number
  dayMax?: number
  statKey?: string
  statOperator?: RuleOperator
  statValue?: number
  flagKey?: string
  flagValue?: boolean
}

export interface SelectionWeightRule {
  id: string
  targetType: SelectionWeightTargetType
  targetKey: string
  operation: SelectionWeightOperation
  value: number

  // Generic conditions (preferred). All conditions must pass.
  conditions?: SelectionCondition[]

  // Legacy fields kept optional for backward compatibility with existing configs.
  filters?: SelectionWeightRuleFilters
  whenCounter?: InteractionRuleCondition
}

export type SelectionConstraintScope = "cycle" | "global"

export interface SelectionConstraintRule {
  id: string
  targetType: SelectionWeightTargetType
  targetKey: string
  // Generic hard-constraint: if this condition is true, matching candidates are blocked.
  counterCondition?: InteractionRuleCondition

  // Optional activation gate for the rule itself.
  whenCounter?: InteractionRuleCondition

  // Legacy fields kept optional for backward compatibility with existing configs.
  maxOccurrences?: number
  scope?: SelectionConstraintScope
  filters?: SelectionWeightRuleFilters
}

export interface GameLogicConfig {
  counters: InteractionCounterConfig[]
  rules: InteractionRule[]
  weightRules?: SelectionWeightRule[]
  constraintRules?: SelectionConstraintRule[]
}

// Example:
// limit 5 global interactions then set world.cycle = 1
export const EXAMPLE_INTERACTION_LIMIT_RULE: InteractionRule = {
  id: "limit-5-set-cycle",
  when: {
    counterKey: "interactions.global",
    operator: "gte",
    value: 5,
  },
  actions: [
    {
      type: "set_world_state",
      key: "world.cycle",
      value: 1,
    },
  ],
}
