import { Condition } from "../domain/conditions"
import { GameState } from "../domain/gameState"

export function evaluateCondition(
  condition: Condition,
  state: GameState
): boolean {
  switch (condition.type) {
    case "stat_min":
      return state.stats[condition.key] >= Number(condition.value)

    case "stat_max":
      return state.stats[condition.key] <= Number(condition.value)

    case "has_item":
      return state.inventory.includes(condition.key)

    case "not_has_item":
      return !state.inventory.includes(condition.key)

    case "flag":
      return state.flags[condition.key] === true

    case "not_flag":
      return !state.flags[condition.key]

    case "time_phase":
      return state.world.phase === condition.value

    case "season":
      return state.world.season === condition.value

    case "day_min":
      return state.world.day >= Number(condition.value)

    case "day_max":
      return state.world.day <= Number(condition.value)

    default:
      return false
  }
}

export function canShowCard(
  conditions: Condition[],
  state: GameState
): boolean {
  return conditions.every(cond => evaluateCondition(cond, state))
}