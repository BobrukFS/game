export type ConditionDataType = "stat" | "world_state" | "flag"
export type ConditionOperator = "equal" | "not_equal" | "min" | "max"
export type LogicOperator = "AND" | "OR"

export interface Condition {
  id?: string
  dataType: ConditionDataType
  operator: ConditionOperator
  key: string
  value?: number | string | boolean
  logicOperator?: LogicOperator
  order?: number
}

/**
 * Recursive condition group that allows combining conditions with AND/OR logic
 * Can contain both individual conditions and nested groups
 * Example: (stat:health > 50 AND flag:alive) OR world_state:level = 2
 */
export interface ConditionGroup {
  id?: string
  operator: LogicOperator  // AND or OR
  conditions: (Condition | ConditionGroup)[]
}

/**
 * Type guard to check if item is a ConditionGroup vs Condition
 */
export function isConditionGroup(item: Condition | ConditionGroup): item is ConditionGroup {
  return "operator" in item && "conditions" in item && !("dataType" in item)
}

/**
 * Get valid operators for a given data type
 * Ensures UI only shows applicable operators
 */
export function getValidOperatorsForDataType(dataType: ConditionDataType): ConditionOperator[] {
  const operatorsByType: Record<ConditionDataType, ConditionOperator[]> = {
    stat: ["min", "max", "equal"],
    world_state: ["equal", "not_equal", "min", "max"],
    flag: ["equal", "not_equal"],
  }
  return operatorsByType[dataType] || []
}

/**
 * Get label for condition operator
 * Used for UI display
 */
export function getOperatorLabel(operator: ConditionOperator): string {
  const labels: Record<ConditionOperator, string> = {
    equal: "Igual a",
    not_equal: "No igual a",
    min: "Mínimo",
    max: "Máximo",
  }
  return labels[operator]
}

/**
 * Get label for data type
 * Used for UI display
 */
export function getDataTypeLabel(dataType: ConditionDataType): string {
  const labels: Record<ConditionDataType, string> = {
    stat: "Estadística",
    world_state: "Estado del Mundo",
    flag: "Bandera",
  }
  return labels[dataType]
}