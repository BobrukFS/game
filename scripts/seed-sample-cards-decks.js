const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const GAME_ID = process.argv[2] || "cc795b46-4d3e-42ea-9810-1a1947cc46ed"

const SIM_PREFIX = "[SIM]"

function buildDeckPlan() {
  const plans = []

  for (let i = 1; i <= 4; i += 1) {
    plans.push({
      name: `${SIM_PREFIX} MAIN Arco ${String(i).padStart(2, "0")}`,
      type: "main",
      weight: 8,
      repeatable: false,
      cardCount: 6,
      sequenceStyle: "main",
    })
  }

  for (let i = 1; i <= 4; i += 1) {
    plans.push({
      name: `${SIM_PREFIX} SECONDARY Arco ${String(i).padStart(2, "0")}`,
      type: "Secoundary",
      weight: 5,
      repeatable: false,
      cardCount: 8,
      sequenceStyle: "secondary",
    })
  }

  for (let i = 1; i <= 4; i += 1) {
    plans.push({
      name: `${SIM_PREFIX} RANDOM Lote ${String(i).padStart(2, "0")}`,
      type: "random",
      weight: 3,
      repeatable: true,
      cardCount: 6,
      sequenceStyle: "none",
    })
  }

  for (let i = 1; i <= 4; i += 1) {
    plans.push({
      name: `${SIM_PREFIX} CONTEXT Lote ${String(i).padStart(2, "0")}`,
      type: "informant",
      weight: 2,
      repeatable: true,
      cardCount: 5,
      sequenceStyle: "none",
    })
  }

  return plans
}

function cardTypeByIndex(index, sequenceStyle) {
  if (sequenceStyle === "main") {
    const pattern = ["narrative", "narrative", "decision", "narrative", "narrative", "decision"]
    return pattern[index % pattern.length]
  }

  if (sequenceStyle === "secondary") {
    const pattern = [
      "narrative",
      "decision",
      "narrative",
      "narrative",
      "narrative",
      "decision",
      "narrative",
      "narrative",
    ]
    return pattern[index % pattern.length]
  }

  const pattern = ["narrative", "narrative", "narrative", "decision", "narrative", "narrative"]
  return pattern[index % pattern.length]
}

function cardPriorityByType(cardType, index, sequenceStyle) {
  if (sequenceStyle === "main") return index
  if (sequenceStyle === "secondary") return index + 2
  if (cardType === "decision") return 5
  return null
}

function isInteractionFlavor(index, sequenceStyle) {
  if (sequenceStyle === "main") return index === 3
  if (sequenceStyle === "secondary") return index === 3
  return index === 1 || index === 5
}

function cardTitle(deckName, deckType, idx) {
  const n = idx + 1
  if (deckType === "main") return `${deckName} · Escena principal ${n}`
  if (deckType === "Secoundary") return `${deckName} · Escena secundaria ${n}`
  if (deckType === "random") return `${deckName} · Evento aleatorio ${n}`
  return `${deckName} · Contexto ${n}`
}

async function createDeckAndCards(plan) {
  const deck = await prisma.deck.create({
    data: {
      gameId: GAME_ID,
      name: plan.name,
      type: plan.type,
      weight: plan.weight,
      repeatable: plan.repeatable,
      description: `Deck de ejemplo para simulacion (${plan.type})`,
    },
  })

  const cards = []

  for (let i = 0; i < plan.cardCount; i += 1) {
    const type = cardTypeByIndex(i, plan.sequenceStyle)
    const interactionFlavor = isInteractionFlavor(i, plan.sequenceStyle)
    const card = await prisma.card.create({
      data: {
        deckId: deck.id,
        title: cardTitle(plan.name, plan.type, i),
        type,
        description: `Carta de ejemplo #${i + 1} para ${plan.name}.`,
        priority: cardPriorityByType(type, i, plan.sequenceStyle),
        tags: ["sim", plan.type.toLowerCase(), type, ...(interactionFlavor ? ["interaction-flavor"] : [])],
      },
    })

    cards.push(card)
  }

  return { deck, cards }
}

async function wireSequenceOptions(sequenceStyle, cards) {
  if (sequenceStyle === "main") {
    // decision card idx 2 branches to idx 3 or 4
    await prisma.option.createMany({
      data: [
        {
          cardId: cards[2].id,
          text: "Tomar el camino directo",
          order: 1,
          nextCardId: cards[3].id,
        },
        {
          cardId: cards[2].id,
          text: "Investigar antes de actuar",
          order: 2,
          nextCardId: cards[4].id,
        },
      ],
    })

    // decision card idx 5 closes branch without nextCardId
    await prisma.option.createMany({
      data: [
        {
          cardId: cards[5].id,
          text: "Cerrar capitulo y seguir",
          order: 1,
          nextCardId: null,
        },
        {
          cardId: cards[5].id,
          text: "Cerrar con duda narrativa",
          order: 2,
          nextCardId: null,
        },
      ],
    })
    return
  }

  if (sequenceStyle === "secondary") {
    await prisma.option.createMany({
      data: [
        {
          cardId: cards[1].id,
          text: "Seguir pista secundaria A",
          order: 1,
          nextCardId: cards[2].id,
        },
        {
          cardId: cards[1].id,
          text: "Seguir pista secundaria B",
          order: 2,
          nextCardId: cards[3].id,
        },
        {
          cardId: cards[5].id,
          text: "Resolver subtrama",
          order: 1,
          nextCardId: cards[6].id,
        },
        {
          cardId: cards[5].id,
          text: "Postergar subtrama",
          order: 2,
          nextCardId: cards[7].id,
        },
      ],
    })
    return
  }

  // non-sequential decks: give decisions local options with no explicit next card
  for (const card of cards) {
    if (card.type !== "decision") continue
    await prisma.option.createMany({
      data: [
        {
          cardId: card.id,
          text: "Aceptar evento",
          order: 1,
          nextCardId: null,
        },
        {
          cardId: card.id,
          text: "Rechazar evento",
          order: 2,
          nextCardId: null,
        },
      ],
    })
  }
}

async function main() {
  const game = await prisma.game.findUnique({
    where: { id: GAME_ID },
    select: { id: true, name: true },
  })

  if (!game) {
    throw new Error(`Game not found: ${GAME_ID}`)
  }

  const existingSimDecks = await prisma.deck.findMany({
    where: {
      gameId: GAME_ID,
      name: { startsWith: SIM_PREFIX },
    },
    select: { id: true },
  })

  if (existingSimDecks.length > 0) {
    await prisma.deck.deleteMany({
      where: {
        id: { in: existingSimDecks.map((d) => d.id) },
      },
    })
  }

  const plan = buildDeckPlan()
  const created = []

  for (const item of plan) {
    const createdDeck = await createDeckAndCards(item)
    await wireSequenceOptions(item.sequenceStyle, createdDeck.cards)
    created.push(createdDeck)
  }

  const totalDecks = created.length
  const totalCards = created.reduce((acc, entry) => acc + entry.cards.length, 0)
  const totalDecisionCards = created.reduce(
    (acc, entry) => acc + entry.cards.filter((c) => c.type === "decision").length,
    0
  )

  console.log(
    JSON.stringify(
      {
        gameId: GAME_ID,
        gameName: game.name,
        removedPreviousSimDecks: existingSimDecks.length,
        createdDecks: totalDecks,
        createdCards: totalCards,
        createdDecisionCards: totalDecisionCards,
        breakdown: {
          mainDecks: 4,
          secondaryDecks: 4,
          randomDecks: 4,
          contextualDecks: 4,
        },
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
