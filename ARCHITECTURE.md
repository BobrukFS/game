# 🎮 Arquitectura del Engine de Juego

## Visión General

La arquitectura está diseñada con **separación clara de responsabilidades** y **escalabilidad**:

- **🎯 Orquestador Central**: `runtime.ts` 
- **⚙️ Engines Puros**: Lógica modulada y reutilizable
- **📊 Datos**: Aislados de la lógica

```
UI Components → runtime.ts → [effectEngine, conditionEngine, ruleEngine]
                     ↓
                 PlayRuntimeBundle (datos)
```

---

## Capas de la Arquitectura

### 1. 🎯 Orquestador: `src/lib/play/runtime.ts`

**Responsabilidad**: Coordinar el flujo del juego usando los engines.

**Funciones principales**:
- `drawNextCard(bundle, state, logicConfig)` - Selecciona la siguiente carta
- `applySelectedOption(bundle, state, cardId, optionId)` - Aplica una opción del jugador
- `buildInitialGameState(bundle)` - Inicializa el estado del juego

**Qué hace**:
1. **Selección de cartas** - Filtra cartas válidas por condiciones y peso
2. **Aplicación de efectos** - Usa `effectEngine.applyEffects()`
3. **Aplicación de reglas** - Usa `ruleEngine.applyGameLogicEvent()`
4. **Debug** - Registra evaluaciones para debugging

**Ejemplo de flujo**:
```typescript
// En runtime.ts → applySelectedOption()
const option = getOption(cardId, optionId)

// 1. Aplicar efectos usando effectEngine
let state = applyEffects(option.effects, state)

// 2. Aplicar reglas usando ruleEngine  
state = applyGameLogicEvent(state, logicConfig, {
  type: "option_selected",
  optionId: optionId
})

// 3. Retornar nuevo estado
return { state, message: "Opción aplicada" }
```

---

### 2. ⚙️ Engines Puros (Reutilizables)

#### A. **effectEngine.ts** - Aplicar Efectos

```typescript
applyEffects(effects: Effect[], state: GameState): GameState
```

**Tipos de efectos soportados**:
- `modify_stat` - Cambiar estadísticas (+ o -)
- `set_flag` - Establecer una bandera true/false
- `remove_flag` - Eliminar bandera (set false)
- `set_world_state` - Cambiar estado del mundo

**Puro**: Solo transforma estado, sin efectos secundarios.

#### B. **conditionEngine.ts** - Evaluar Condiciones

```typescript
evaluateCondition(condition: Condition, state: GameState): boolean
```

**Tipos de condiciones soportadas**:
- `stat_min`, `stat_max` - Llamadas estadísticas >= o <=
- `flag`, `not_flag` - Estado de banderas
- `world_state` - Valores del mundo (día, fase, etc.)

**Puro**: Solo evalúa, sin mutación de estado.

#### C. **ruleEngine.ts** - Aplicar Reglas

```typescript
applyGameLogicEvent(state: GameState, config?: GameLogicConfig, event?: RuntimeRuleEvent): GameState
```

**Maneja**:
- Contadores de interacciones
- Reglas condicionales
- Efectos de reglas (incrementar contadores, etc.)

**Integración**: Runtime lo usa después de efectos para reglas de juego.

---

### 3. 📊 Datos: `PlayRuntimeBundle`

Estructura que agrupa todo lo necesario para una sesión:

```typescript
interface PlayRuntimeBundle {
  games: PlayRuntimeGame[]
  decks: PlayRuntimeDeck[]
  cards: PlayRuntimeCard[]
  options: PlayRuntimeOption[]
  // ... etc
}
```

**Obtenida de**: `src/lib/services/prisma/playRuntime.ts`
**Usada por**: `runtime.ts` para lectura de escenario

---

## Flujo Completo: "Jugar una Opción"

```
UI (RuntimeSession)
  ↓
  │ usuario selecciona opción
  ↓
applySelectedOption(bundle, state, cardId, optionId)
  ├─ 1. Obtener opción de bundle
  ├─ 2. Aplicar efectos
  │    └─→ effectEngine.applyEffects(effects, state)
  │         Modifica: stats, flags, world
  ├─ 3. Detectar cambios de stats
  ├─ 4. Aplicar reglas del juego
  │    └─→ ruleEngine.applyGameLogicEvent(state, config, event)
  │         Maneja: contadores, reglas condicionales
  └─ 5. Retornar nuevo estado
       ↓
    Componente UI actualiza pantalla
```

---

## Arquitectura vs Escalabilidad

### ✅ Escalable porque:

1. **Engines modulares** - Cada engine hace UNA cosa bien
   - Fácil agregar nuevos tipos de efectos en `effectEngine`
   - Fácil agregar nuevas condiciones en `conditionEngine`

2. **Runtime orquesta** - Cambios en flujo = cambios en 1 archivo
   - Agregar fase de "post-procesamiento"? Solo modifica `runtime.ts`
   - Insertar validaciones? `runtime.ts`

3. **Puro y testeable** - Engines sin dependencias externas
   ```typescript
   // Fácil de testear:
   const result = applyEffects([effect1, effect2], initialState)
   expect(result.stats.gold).toBe(10)
   ```

4. **Datos centralizados** - `PlayRuntimeBundle` es fuente única
   - Una carta, un lugar
   - Una regla, un lugar

---

## Código DEPRECADO (No usar)

| Archivo | Razón | Alternativa |
|---------|-------|-------------|
| `gameEngine.ts` | Legacy orchestrator reemplazado | Usa `runtime.ts` |
| `selectionEngine.ts` | Lógica movida a runtime | Usa `runtime.drawNextCard()` |
| `useGame.ts` | Hook obsoleto | Usa `<RuntimeSession />` componente |

---

## Resumen

```
┌────────────────────────────────────────┐
│         UI Components                  │  ← Renderiza el juego
└────────────────┬───────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────┐
│    runtime.ts (ORQUESTADOR)            │  ← Coordina flujo
│  • drawNextCard()                      │
│  • applySelectedOption()               │
│  • buildInitialGameState()             │
└────────────────┬───────────────────────┘
         ┌───────┼────────┐
         ▼       ▼        ▼
    ┌─────────┬──────────┬────────┐
    │ Effect  │Condition │ Rule   │  ← Engines puros
    │ Engine  │ Engine   │ Engine │
    └─────────┴──────────┴────────┘
         ↓
    PlayRuntimeBundle  ← Datos
```

**Resultado**: Código limpio, mantenible, escalable. 🚀
