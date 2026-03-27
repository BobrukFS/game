// lib/engine/effectEngine.ts

import { Effect, GameState } from "@/lib/domain"

export function applyEffects(
  effects: Effect[],
  state: GameState
): GameState {
  const newState: GameState = {
    ...state,
    stats: { ...state.stats },
    inventory: [...state.inventory],
    flags: { ...state.flags }
  }

  for (const effect of effects) {
    switch (effect.type) {
      case "modify_stat":
        newState.stats[effect.key] += Number(effect.value)
        break

      case "add_item":
        if (!newState.inventory.includes(effect.key)) {
          newState.inventory.push(effect.key)
        }
        break

      case "remove_item":
        newState.inventory = newState.inventory.filter(i => i !== effect.key)
        break

      case "set_flag":
        newState.flags[effect.key] = Boolean(effect.value)
        break
    }
  }

  return newState
}