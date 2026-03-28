import { prisma } from "@/lib/prisma"
import type { ConditionDataType, ConditionOperator, LogicOperator } from "@/lib/domain"

export async function getConditionsByCardId(cardId: string) {
  return prisma.condition.findMany({
    where: { cardId },
    orderBy: { order: "asc" },
  });
}

export async function getConditionContextById(id: string) {
  return prisma.condition.findUnique({
    where: { id },
    select: {
      id: true,
      dataType: true,
      key: true,
      card: {
        select: {
          deck: {
            select: {
              gameId: true,
            },
          },
        },
      },
    },
  })
}

export async function createCondition(data: {
  cardId: string;
  dataType: string;
  operator: string;
  key: string;
  value: string;
  logicOperator?: string;
  order?: number;
}) {
  return prisma.condition.create({
    data: {
      cardId: data.cardId,
      dataType: data.dataType as ConditionDataType,
      operator: data.operator as ConditionOperator,
      key: data.key,
      value: data.value,
      logicOperator: data.logicOperator as LogicOperator | undefined,
      order: data.order,
    },
  });
}

export async function updateCondition(
  id: string,
  data: Partial<{ dataType: string; operator: string; key: string; value: string; logicOperator: string; order: number }>
) {
  return prisma.condition.update({
    where: { id },
    data: {
      ...(data.dataType && { dataType: data.dataType as ConditionDataType }),
      ...(data.operator && { operator: data.operator as ConditionOperator }),
      ...(data.key && { key: data.key }),
      ...(data.value && { value: data.value }),
      ...(data.logicOperator && { logicOperator: data.logicOperator as LogicOperator }),
      ...(data.order !== undefined && { order: data.order }),
    },
  });
}

export async function deleteCondition(id: string) {
  return prisma.condition.delete({
    where: { id },
  });
}
