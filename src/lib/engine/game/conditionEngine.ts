import { Condition, ConditionDataType, ConditionOperator } from "../../domain/conditions"
import { GameState } from "../../domain/gameState"

/**
 * Evaluate a single condition against current game state
 * Handles type-specific logic based on dataType and operator
 */
export function evaluateCondition(condition: Condition, state: GameState): boolean {
  switch (condition.dataType) {
    case "stat":
      return evaluateStatCondition(condition, state)

    case "flag":
      return evaluateFlagCondition(condition, state)

    case "world_state":
      return evaluateWorldStateCondition(condition, state)

    default:
      return false
  }
}

/**
 * Evaluate stat conditions (numeric comparisons)
 */
function evaluateStatCondition(condition: Condition, state: GameState): boolean {
  const statValue = Number(state.stats[condition.key] || 0)
  const conditionValue = Number(condition.value || 0)

  switch (condition.operator) {
    case "min":
      return statValue >= conditionValue
    case "max":
      return statValue <= conditionValue
    case "equal":
      return statValue === conditionValue
    case "not_equal":
      return statValue !== conditionValue
    default:
      return false
  }
}

/**
 * Evaluate flag conditions (boolean checks)
 * Flags are stored as booleans in state
 */
function evaluateFlagCondition(condition: Condition, state: GameState): boolean {
  const flagValue = state.flags[condition.key] === true

  switch (condition.operator) {
    case "equal":
      return flagValue === true
    case "not_equal":
      return flagValue !== true
    default:
      return false
  }
}

/**
 * Evaluate world_state conditions
 * World state values can be strings, numbers, or arrays (stored as JSON)
 * Numeric and array values support min/max (comparing value or array length)
 */
function evaluateWorldStateCondition(condition: Condition, state: GameState): boolean {
  const worldValue = state.world[condition.key]
  const conditionValue = condition.value

  if (worldValue === undefined || conditionValue === undefined) {
    return false
  }

  // Try to parse array values
  let worldArray: any[] | null = null
  let conditionArray: any[] | null = null

  try {
    if (typeof worldValue === "string") {
      worldArray = JSON.parse(worldValue)
    }
  } catch {
    // Not a valid JSON array
  }

  try {
    if (typeof conditionValue === "string") {
      conditionArray = JSON.parse(conditionValue)
    }
  } catch {
    // Not a valid JSON array
  }

  // Handle min/max operators
  if (condition.operator === "min" || condition.operator === "max") {
    // For arrays, compare array length
    if (Array.isArray(worldArray) && Array.isArray(conditionArray)) {
      const worldLength = worldArray.length
      const conditionLength = conditionArray.length

      return condition.operator === "min"
        ? worldLength >= conditionLength
        : worldLength <= conditionLength
    }

    // For numeric values, standard numeric comparison
    const numWorldValue = Number(worldValue)
    const numConditionValue = Number(conditionValue)

    if (!isNaN(numWorldValue) && !isNaN(numConditionValue)) {
      return condition.operator === "min"
        ? numWorldValue >= numConditionValue
        : numWorldValue <= numConditionValue
    }
  }

  // String comparison for equal/not_equal (works for arrays too as strings)
  const worldString = Array.isArray(worldArray) ? JSON.stringify(worldArray) : String(worldValue)
  const conditionString = Array.isArray(conditionArray) ? JSON.stringify(conditionArray) : String(conditionValue)

  switch (condition.operator) {
    case "equal":
      return worldString === conditionString
    case "not_equal":
      return worldString !== conditionString
    default:
      return false
  }
}

/**
 * Check if all conditions are met for a card
 * Respects AND/OR logic operators between conditions
 */
export function canShowCard(conditions: Condition[], state: GameState): boolean {
  if (conditions.length === 0) return true

  // Group conditions by logic operator for proper evaluation
  let currentGroup: Condition[] = []
  let groupOperator: "AND" | "OR" = "AND"
  let hasAnd = true

  for (const condition of conditions) {
    const nextOperator = condition.logicOperator || "AND"

    // If operator changes, evaluate current group
    if (nextOperator !== groupOperator && currentGroup.length > 0) {
      const groupResult = evaluateConditionGroup(currentGroup, groupOperator, state)
      hasAnd = hasAnd && groupResult
      currentGroup = []
    }

    currentGroup.push(condition)
    groupOperator = nextOperator
  }

  // Evaluate final group
  if (currentGroup.length > 0) {
    const groupResult = evaluateConditionGroup(currentGroup, groupOperator, state)
    hasAnd = hasAnd && groupResult
  }

  return hasAnd
}

/**
 * Evaluate a group of conditions with the same operator
 */
function evaluateConditionGroup(conditions: Condition[], operator: "AND" | "OR", state: GameState): boolean {
  if (operator === "AND") {
    return conditions.every(cond => evaluateCondition(cond, state))
  } else {
    return conditions.some(cond => evaluateCondition(cond, state))
  }
}