-- Refactor Conditions table to separate dataType and operator
-- Maps old type values to new (dataType, operator) pairs

-- Step 1: Add new columns
ALTER TABLE conditions 
ADD COLUMN data_type VARCHAR(50),
ADD COLUMN operator VARCHAR(50);

-- Step 2: Map existing types to new structure
UPDATE conditions
SET 
  data_type = 'stat',
  operator = 'min'
WHERE type = 'stat_min';

UPDATE conditions
SET 
  data_type = 'stat',
  operator = 'max'
WHERE type = 'stat_max';

UPDATE conditions
SET 
  data_type = 'flag',
  operator = 'equal'
WHERE type = 'flag';

UPDATE conditions
SET 
  data_type = 'flag',
  operator = 'not_equal'
WHERE type = 'not_flag';

UPDATE conditions
SET 
  data_type = 'world_state',
  operator = 'equal'
WHERE type = 'world_state';

-- Step 3: Set defaults for any unmapped types (safety)
UPDATE conditions
SET 
  data_type = 'stat',
  operator = 'equal'
WHERE data_type IS NULL;

-- Step 4: Make new columns NOT NULL
ALTER TABLE conditions 
ALTER COLUMN data_type SET NOT NULL,
ALTER COLUMN operator SET NOT NULL;

-- Step 5: Drop old type column
ALTER TABLE conditions DROP COLUMN type;

-- Step 6: Add check constraints for valid combinations
ALTER TABLE conditions 
ADD CONSTRAINT valid_operator_for_datatype CHECK (
  (data_type = 'stat' AND operator IN ('min', 'max', 'equal')) OR
  (data_type = 'flag' AND operator IN ('equal', 'not_equal')) OR
  (data_type = 'world_state' AND operator IN ('equal', 'not_equal', 'min', 'max'))
);
