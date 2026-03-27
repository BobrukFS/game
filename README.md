# Reigns Narrative Event Editor (MVP)

Production-oriented MVP for creating decks/cards, authoring conditions and effects, editing global stats, and simulating weighted event draws.

## Stack

- Next.js App Router + TypeScript
- TailwindCSS (dark-first UI)
- Supabase (PostgreSQL + API)
- Zustand for client state and simulation runtime

## Why Zustand

Zustand is used because simulation state is highly interactive and shared across disconnected UI zones (sidebar stats, simulator panel, and card detail). It keeps the runtime state simple, typed, and decoupled from server data loading.

## Project Structure

```text
.
├── src
│   ├── app
│   │   ├── actions.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components
│   │   ├── editor-app.tsx
│   │   └── ui.tsx
│   ├── lib
│   │   ├── domain
│   │   │   ├── conditions.ts
│   │   │   ├── effects.ts
│   │   │   ├── selection.ts
│   │   │   └── simulation.ts
│   │   ├── services
│   │   │   ├── bundle.ts
│   │   │   ├── mappers.ts
│   │   │   └── mockData.ts
│   │   └── supabase
│   │       ├── client.ts
│   │       └── server.ts
│   ├── stores
│   │   └── editorStore.ts
│   └── types
│       ├── db.ts
│       └── domain.ts
└── supabase
    ├── schema.sql
    └── seed.sql
```

## Core Logic

- Condition validation: `src/lib/domain/conditions.ts`
- Weighted draw + validity filtering: `src/lib/domain/selection.ts`
- Effect application: `src/lib/domain/effects.ts`
- Simulation flow orchestration: `src/lib/domain/simulation.ts`

Card selection uses:

```ts
validCards = cards.filter(card => conditionsMet(card, state))
selected = weightedRandom(validCards)
```

Story priority override is supported: if valid cards with `priority > 0` exist, draw is resolved only within that priority subset.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env values:
   ```bash
   cp .env.example .env.local
   ```
3. Run SQL in Supabase:
   - `supabase/schema.sql`
   - `supabase/seed.sql`
4. Start dev server:
   ```bash
   npm run dev
   ```

If env vars are missing, the app falls back to local mock data so the editor/simulation still works for UI development.