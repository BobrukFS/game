export type WorldStateValueType = "number" | "string" | "boolean" | "array"

export interface WorldState {
  id: string
  key: string
  valueType: WorldStateValueType
  value: number | string | boolean | string[]
}
