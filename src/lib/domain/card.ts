import { Condition, ConditionGroup } from "./conditions"
import { Option } from "./option"

export type CardType = "decision" | "narrative" | "interactive";

export interface Card {
  id: string
  deckId: string
  title: string
  description: string
  type: CardType
  priority?: number
  conditions: Condition[] | ConditionGroup[]
  options?: [Option, Option]
  tags: string[]
  createdAt?: string
}