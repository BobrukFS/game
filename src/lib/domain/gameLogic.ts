import { WorldStateValue } from "./gameState"

export type InteractionScope = "global" | "deck" | "card"

export interface InteractionCounterConfig {
  key: string
  scope: InteractionScope
  description?: string
}

export type RuleOperator = "eq" | "gt" | "gte" | "lt" | "lte"

export interface InteractionRuleCondition {
  counterKey: string
  operator: RuleOperator
  value: number
}

export type GameRuleAction =
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
  when: InteractionRuleCondition
  actions: GameRuleAction[]
}

export interface GameLogicConfig {
  counters: InteractionCounterConfig[]
  rules: InteractionRule[]
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
