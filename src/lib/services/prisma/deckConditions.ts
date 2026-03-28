import { prisma } from "@/lib/prisma"
import type { ConditionDataType, ConditionOperator, LogicOperator } from "@/lib/domain"

export async function getDeckConditionsByDeckId(deckId: string) {
  return prisma.deckCondition.findMany({
    where: { deckId },
    orderBy: { order: "asc" },
  })
}

export async function createDeckCondition(data: {
  deckId: string
  dataType: string
  operator: string
  key: string
  logicOperator?: string
  order?: number
}) {
  return prisma.deckCondition.create({
    data: {
      deckId: data.deckId,
      dataType: data.dataType as ConditionDataType,
      operator: data.operator as ConditionOperator,
      key: data.key,
      logicOperator: (data.logicOperator || "AND") as LogicOperator,
      order: data.order || 1,
    },
  })
}

export async function updateDeckCondition(
  id: string,
  data: Partial<{
    dataType: string
    operator: string
    key: string
    logicOperator: string
    order: number
  }>
) {
  return prisma.deckCondition.update({
    where: { id },
    data: {
      ...(data.dataType && { dataType: data.dataType as ConditionDataType }),
      ...(data.operator && { operator: data.operator as ConditionOperator }),
      ...(data.key && { key: data.key }),
      ...(data.logicOperator && { logicOperator: data.logicOperator as LogicOperator }),
      ...(data.order !== undefined && { order: data.order }),
    },
  })
}

export async function deleteDeckCondition(id: string) {
  return prisma.deckCondition.delete({
    where: { id },
  })
}
