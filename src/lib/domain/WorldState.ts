export type WorldStateValueType = "number" | "string" | "boolean" | "array" | "enum"

export interface WorldStateEnumValue {
  current: string
  options: string[]
}

export interface WorldState {
  id: string
  key: string
  valueType: WorldStateValueType
  value: number | string | boolean | string[] | WorldStateEnumValue
}
