import { Effect } from "./effects"

export interface Option {
  id: string
  cardId: string
  text: string
  order: number
  effects: Effect[]
  nextCardId?: string
}