-- Add explicit flags table for variable catalog
-- Flags can be created from Variables UI or auto-created by set_flag effects

CREATE TABLE IF NOT EXISTS flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  key text NOT NULL,
  UNIQUE(game_id, key)
);

CREATE INDEX IF NOT EXISTS idx_flags_game ON flags(game_id);
