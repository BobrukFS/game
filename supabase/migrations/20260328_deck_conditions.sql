-- Deck conditions (flag-only) for gating entire decks

CREATE TABLE IF NOT EXISTS deck_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  data_type text NOT NULL DEFAULT 'flag',
  operator text NOT NULL,
  key text NOT NULL,
  logic_operator text NOT NULL DEFAULT 'AND',
  "order" integer NOT NULL DEFAULT 1,
  CONSTRAINT deck_conditions_data_type_flag CHECK (data_type = 'flag'),
  CONSTRAINT deck_conditions_operator_check CHECK (operator in ('equal', 'not_equal')),
  CONSTRAINT deck_conditions_logic_operator_check CHECK (logic_operator in ('AND', 'OR'))
);

CREATE INDEX IF NOT EXISTS idx_deck_conditions_deck ON deck_conditions(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_conditions_deck_order ON deck_conditions(deck_id, "order");
