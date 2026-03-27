export type WorldStateValueType = "number" | "string" | "boolean"

export interface WorldState {
  id: string
  key: string
  valueType: WorldStateValueType
  value: number | string | boolean
}
