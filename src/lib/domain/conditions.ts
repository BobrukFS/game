
export type ConditionType = "stat_min" | "stat_max" | "flag" | "not_flag" | "world_state"

export interface Condition {
  id?: string
  type: ConditionType
  key: string
  value?: number | string | boolean
}