"use client"

import { useState } from "react"
import type { Condition, ConditionGroup } from "@/lib/domain/conditions"
import { isConditionGroup, getValidOperatorsForDataType, getOperatorLabel } from "@/lib/domain/conditions"
import type { ConditionDataType, ConditionOperator } from "@/lib/domain/conditions"

interface ConditionGroupBuilderProps {
  conditions: (Condition | ConditionGroup)[]
  onChange: (conditions: (Condition | ConditionGroup)[]) => void
  statKeys: Set<string>
  worldStateKeys: Set<string>
  flagKeys: Set<string>
}

/**
 * Component to build conditions with AND/OR grouping
 * Supports nested condition groups for complex logic
 */
export default function ConditionGroupBuilder({
  conditions,
  onChange,
  statKeys,
  worldStateKeys,
  flagKeys,
}: ConditionGroupBuilderProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)

  const handleAddCondition = (dataType: ConditionDataType) => {
    const newCondition: Condition = {
      dataType,
      operator: "equal" as ConditionOperator,
      key: "",
      value: "",
    }
    onChange([...conditions, newCondition])
    setShowAddForm(false)
  }

  const handleAddGroup = () => {
    const newGroup: ConditionGroup = {
      operator: "AND",
      conditions: [],
    }
    onChange([...conditions, newGroup])
    setShowGroupForm(false)
  }

  const handleRemove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index))
  }

  const handleUpdateCondition = (index: number, updates: Partial<Condition>) => {
    const item = conditions[index]
    if (!isConditionGroup(item)) {
      const updated = { ...item, ...updates }
      const newConditions = [...conditions]
      newConditions[index] = updated
      onChange(newConditions)
    }
  }

  const handleUpdateGroup = (index: number, updates: Partial<ConditionGroup>) => {
    const item = conditions[index]
    if (isConditionGroup(item)) {
      const updated = { ...item, ...updates }
      const newConditions = [...conditions]
      newConditions[index] = updated
      onChange(newConditions)
    }
  }

  return (
    <div className="space-y-4 rounded bg-slate-900 p-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Condiciones</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white text-sm"
          >
            + Condición
          </button>
          <button
            onClick={() => setShowGroupForm(!showGroupForm)}
            className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-white text-sm"
          >
            + Grupo
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-slate-800 p-3 rounded space-y-2">
          <p className="text-sm font-semibold mb-2">Selecciona tipo:</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleAddCondition("stat")}
              className="bg-green-700 hover:bg-green-800 px-3 py-2 rounded text-white text-sm"
            >
              Stat
            </button>
            <button
              onClick={() => handleAddCondition("flag")}
              className="bg-green-700 hover:bg-green-800 px-3 py-2 rounded text-white text-sm"
            >
              Flag
            </button>
            <button
              onClick={() => handleAddCondition("world_state")}
              className="bg-green-700 hover:bg-green-800 px-3 py-2 rounded text-white text-sm"
            >
              World State
            </button>
          </div>
        </div>
      )}

      {showGroupForm && (
        <div className="bg-slate-800 p-3 rounded space-y-2">
          <p className="text-sm font-semibold mb-2">Nuevo grupo:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                handleAddGroup()
                setShowGroupForm(false)
              }}
              className="bg-purple-700 hover:bg-purple-800 px-3 py-2 rounded text-white text-sm"
            >
              Grupo AND
            </button>
            <button
              onClick={() => {
                const newGroup: ConditionGroup = {
                  operator: "OR",
                  conditions: [],
                }
                onChange([...conditions, newGroup])
                setShowGroupForm(false)
              }}
              className="bg-purple-700 hover:bg-purple-800 px-3 py-2 rounded text-white text-sm"
            >
              Grupo OR
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {conditions.length === 0 ? (
          <p className="text-slate-400 text-sm italic">Sin condiciones</p>
        ) : (
          conditions.map((item, index) =>
            isConditionGroup(item) ? (
              <ConditionGroupNode
                key={index}
                index={index}
                group={item as ConditionGroup}
                onUpdate={(updates) => handleUpdateGroup(index, updates)}
                onRemove={() => handleRemove(index)}
              />
            ) : (
              <ConditionNode
                key={index}
                index={index}
                condition={item as Condition}
                onUpdate={(updates) => handleUpdateCondition(index, updates)}
                onRemove={() => handleRemove(index)}
                statKeys={statKeys}
                worldStateKeys={worldStateKeys}
                flagKeys={flagKeys}
              />
            )
          )
        )}
      </div>
    </div>
  )
}

interface ConditionNodeProps {
  index: number
  condition: Condition
  onUpdate: (updates: Partial<Condition>) => void
  onRemove: () => void
  statKeys: Set<string>
  worldStateKeys: Set<string>
  flagKeys: Set<string>
}

function ConditionNode({
  index,
  condition,
  onUpdate,
  onRemove,
  statKeys,
  worldStateKeys,
  flagKeys,
}: ConditionNodeProps) {
  const validOperators = getValidOperatorsForDataType(condition.dataType)
  const keys = condition.dataType === "stat" ? statKeys : condition.dataType === "flag" ? flagKeys : worldStateKeys

  const handleDataTypeChange = (dataType: ConditionDataType) => {
    const nextOperators = getValidOperatorsForDataType(dataType)
    onUpdate({
      dataType,
      key: "",
      operator: nextOperators[0] || "equal",
    })
  }

  return (
    <div className="bg-slate-800 p-3 rounded border-l-2 border-green-500 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-slate-300">Condición {index + 1}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-300 text-xs">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select
          value={condition.dataType}
          onChange={(e) => handleDataTypeChange(e.target.value as ConditionDataType)}
          className="px-2 py-1 bg-slate-700 rounded text-white text-sm"
        >
          <option value="stat">Stat</option>
          <option value="flag">Flag</option>
          <option value="world_state">World State</option>
        </select>

        <select
          value={condition.key}
          onChange={(e) => onUpdate({ key: e.target.value })}
          className="px-2 py-1 bg-slate-700 rounded text-white text-sm"
        >
          <option value="">Selecciona key...</option>
          {Array.from(keys).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>

        <select
          value={condition.operator}
          onChange={(e) => onUpdate({ operator: e.target.value as ConditionOperator })}
          className="px-2 py-1 bg-slate-700 rounded text-white text-sm"
          disabled={!condition.key}
        >
          {validOperators.map((op) => (
            <option key={op} value={op}>
              {getOperatorLabel(op)}
            </option>
          ))}
        </select>
      </div>

      <input
        type="text"
        value={String(condition.value || "")}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Valor"
        className="w-full px-2 py-1 bg-slate-700 rounded text-white text-sm"
      />
    </div>
  )
}

interface ConditionGroupNodeProps {
  index: number
  group: ConditionGroup
  onUpdate: (updates: Partial<ConditionGroup>) => void
  onRemove: () => void
}

function ConditionGroupNode({ index, group, onUpdate, onRemove }: ConditionGroupNodeProps) {
  return (
    <div className="bg-slate-800 p-3 rounded border-l-2 border-purple-500 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-slate-300">Grupo {index + 1}</span>
        <div className="flex items-center gap-2">
          <select
            value={group.operator}
            onChange={(e) => onUpdate({ operator: e.target.value as "AND" | "OR" })}
            className="px-2 py-1 bg-slate-700 rounded text-white text-sm"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
          <button onClick={onRemove} className="text-red-400 hover:text-red-300 text-xs">
            ✕
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 italic">{group.conditions.length} items</p>
    </div>
  )
}
