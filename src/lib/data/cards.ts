import { Card } from "@/lib/domain"

export const cards: Card[] = [
  {
    id: "1",
    deckId: "global",
    title: "Paquete extraño",
    description: "Algo se mueve dentro.",
    type: "decision",
    tags: [],
    conditions: [],
    options: [
      {
        id: "opt1",
        cardId: "1",
        text: "Abrir",
        order: 0,
        effects: [
          { type: "set_flag", key: "opened_package", value: true },
          { type: "modify_stat", key: "suspicion", value: 1 }
        ]
      },
      {
        id: "opt1b",
        cardId: "1",
        text: "Ignorar",
        order: 1,
        effects: [
          { type: "modify_stat", key: "lucidity", value: 1 }
        ]
      }
    ]
  },
  {
    id: "2",
    deckId: "global",
    title: "El contenido se revela",
    description: "No deberías haber mirado.",
    type: "decision",
    tags: [],
    conditions: [
      { dataType: "flag", operator: "equal", key: "opened_package" }
    ],
    options: [
      {
        id: "opt2",
        cardId: "2",
        text: "Aceptar",
        order: 0,
        effects: [
          { type: "modify_stat", key: "lucidity", value: -2 }
        ]
      },
      {
        id: "opt2b",
        cardId: "2",
        text: "Cerrar de golpe",
        order: 1,
        effects: [
          { type: "modify_stat", key: "suspicion", value: 1 },
          { type: "set_flag", key: "rejected_vision", value: true }
        ]
      }
    ]
  },
  {
  id: "3",
  deckId: "global",
  title: "El eco insiste",
  description: "Aunque lo rechazaste, sigue ahí.",
  type: "decision",
  tags: [],
  conditions: [
    { dataType: "flag", operator: "equal", key: "rejected_vision" }
  ],
  options: [
    {
      id: "opt3",
      cardId: "3",
      text: "Escuchar",
      order: 0,
      effects: [
        { type: "modify_stat", key: "lucidity", value: -1 }
      ]
    },
    {
      id: "opt3b",
      cardId: "3",
      text: "Taparte los oídos",
      order: 1,
      effects: [
        { type: "modify_stat", key: "lucidity", value: 1 }
      ]
    }
  ]
}
]