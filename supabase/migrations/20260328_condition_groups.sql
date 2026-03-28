-- Conditions now support nested groups via JSON structure
-- Old structure: flat array of conditions with logicOperator field
-- New structure: conditions array can contain Condition or ConditionGroup objects
-- For now, we store as JSON and client-side handles parsing/validation

-- No database changes required - conditions are already JSON compatible in most implementations
-- This migration is for documentation and future versioning

-- If migrating to strict typed groups, would need:
-- ALTER TABLE cards ADD COLUMN condition_groups JSONB;
-- Then migrate data and deprecate old structure

-- For now: client-side evaluates both flat (legacy) and grouped (new) structures

CREATE OR REPLACE FUNCTION version_info() RETURNS TEXT AS $$
BEGIN
  RETURN 'Conditions now support nested groups (AND/OR) - backward compatible';
END;
$$ LANGUAGE plpgsql;
