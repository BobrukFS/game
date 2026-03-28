alter table if exists game_logic_configs
  add column if not exists weight_rules jsonb not null default '[]'::jsonb;
