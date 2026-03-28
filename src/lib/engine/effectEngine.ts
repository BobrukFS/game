// lib/engine/effectEngine.ts

import { Effect, GameState } from "@/lib/domain"

type NumericEffectPayload = {
  mode: "set" | "increment" | "decrement"
  unit: "number" | "percent"
  amount: number
}

type WorldNumberPayload = {
  targetType: "number"
  mode: "set" | "increment" | "decrement"
  unit: "number" | "percent"
  amount: number
}

type WorldArrayPayload = {
  targetType: "array"
  mode: "add" | "remove" | "clear"
  item?: string
}

type FlagPayload = {
  mode: "set" | "remove"
}

function parsePayload<T>(value: unknown): T | null {
  if (typeof value !== "string") return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function applyNumericOperation(current: number, payload: NumericEffectPayload): number {
  if (!Number.isFinite(payload.amount)) return current

  const delta = payload.unit === "percent"
    ? current * (payload.amount / 100)
    : payload.amount

  if (payload.mode === "set") {
    return payload.unit === "percent" ? current * (payload.amount / 100) : payload.amount
  }

  if (payload.mode === "increment") {
    return current + delta
  }

  return current - delta
}

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
        {
          const current = Number(newState.stats[effect.key] || 0)
          const payload = parsePayload<NumericEffectPayload>(effect.value)

          if (payload) {
            newState.stats[effect.key] = applyNumericOperation(current, payload)
          } else {
            // Legacy behavior: plain numeric delta
            newState.stats[effect.key] = current + Number(effect.value || 0)
          }
        }
        break

      case "remove_flag":
        newState.flags[effect.key] = false
        break

      case "set_world_state":
        if (typeof newState.world[effect.key] === "number") {
          newState.world[effect.key] = Number(effect.value)
        } else if (typeof newState.world[effect.key] === "boolean") {
          newState.world[effect.key] = Boolean(effect.value)
        } else {
          newState.world[effect.key] = String(effect.value)
        }
        break

      case "set_flag":
        newState.flags[effect.key] = Boolean(effect.value)
        break

      case "modify_flag":
        {
          const payload = parsePayload<FlagPayload>(effect.value)
          if (payload?.mode === "set") {
            newState.flags[effect.key] = true
          } else {
            newState.flags[effect.key] = false
          }
        }
        break

      case "modify_world_state":
        {
          const raw = newState.world[effect.key]
          const numberPayload = parsePayload<WorldNumberPayload>(effect.value)
          const arrayPayload = parsePayload<WorldArrayPayload>(effect.value)

          if (numberPayload?.targetType === "number") {
            const current = Number(raw || 0)
            newState.world[effect.key] = applyNumericOperation(current, {
              mode: numberPayload.mode,
              unit: numberPayload.unit,
              amount: numberPayload.amount,
            })
            break
          }

          if (arrayPayload?.targetType === "array") {
            const currentArray = Array.isArray(raw) ? [...raw] : []

            if (arrayPayload.mode === "clear") {
              newState.world[effect.key] = []
              break
            }

            const item = String(arrayPayload.item || "")
            if (!item) {
              break
            }

            if (arrayPayload.mode === "add") {
              newState.world[effect.key] = [...currentArray, item]
            } else if (arrayPayload.mode === "remove") {
              newState.world[effect.key] = currentArray.filter((entry) => entry !== item)
            }
            break
          }

          // Legacy behavior: numeric delta
          const current = Number(raw || 0)
          newState.world[effect.key] = current + Number(effect.value || 0)
        }
        break
    }
  }

  return newState
}