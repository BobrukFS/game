// src/lib/engine/debugEngine.ts

import { Card, GameState } from "@/lib/domain"
import { evaluateCondition, evaluateConditionGroup, canShowCard } from "./conditionEngine"
import { isConditionGroup } from "@/lib/domain/conditions"

export function debugCards(cards: Card[], state: GameState) {
  return cards.map(card => {
    const canShow = canShowCard(card.conditions, state)

    return {
      id: card.id,
      title: card.title,
      canShow,
      conditionStructure: card.conditions.map(debugConditionOrGroup)
    }
  })
}

function debugConditionOrGroup(item: any): any {
  if (isConditionGroup(item)) {
    return {
      type: "group",
      operator: item.operator,
      items: item.conditions.map(debugConditionOrGroup)
    }
  } else {
    return {
      type: "condition",
      dataType: item.dataType,
      operator: item.operator,
      key: item.key,
      value: item.value
    }
  }
}