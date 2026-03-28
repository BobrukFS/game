-- Add logic operator support to conditions
ALTER TABLE conditions ADD COLUMN logic_operator VARCHAR(10) DEFAULT 'AND' CHECK (logic_operator IN ('AND', 'OR'));

-- Add order column to maintain sequence
ALTER TABLE conditions ADD COLUMN "order" INT DEFAULT 1;

-- Create index for ordering
CREATE INDEX idx_conditions_card_order ON conditions(card_id, "order");
