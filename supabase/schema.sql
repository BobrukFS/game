create extension if not exists "pgcrypto";

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  type text not null,
  weight integer not null default 1 check (weight > 0),
  description text not null default ''
);

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  title text not null,
  type text not null default 'narrative',
  description text not null default '',
  priority integer not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists conditions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  type text not null,
  key text not null,
  value text not null
);

create table if not exists options (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references cards(id) on delete cascade,
  text text not null,
  "order" integer not null default 1,
  next_card_id uuid references cards(id) on delete set null
);

create table if not exists effects (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references options(id) on delete cascade,
  type text not null,
  key text not null,
  value text not null
);

create table if not exists global_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  key text not null,
  value integer not null default 0,
  min integer not null default 0,
  max integer not null default 100,
  unique(game_id, key)
);

create table if not exists world_states (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  key text not null,
  value_type text not null,
  value text not null,
  unique(game_id, key)
);

create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  key text not null,
  unique(game_id, key)
);

create table if not exists deck_conditions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  data_type text not null default 'flag',
  operator text not null,
  key text not null,
  logic_operator text not null default 'AND',
  "order" integer not null default 1,
  constraint deck_conditions_data_type_flag check (data_type = 'flag'),
  constraint deck_conditions_operator_check check (operator in ('equal', 'not_equal')),
  constraint deck_conditions_logic_operator_check check (logic_operator in ('AND', 'OR'))
);

create table if not exists game_logic_configs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references games(id) on delete cascade,
  counters jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  weight_rules jsonb not null default '[]'::jsonb,
  constraint_rules jsonb not null default '[]'::jsonb
);

create index if not exists idx_games_id on games(id);
create index if not exists idx_decks_game on decks(game_id);
create index if not exists idx_decks_id on decks(id);
create index if not exists idx_cards_deck on cards(deck_id);
create index if not exists idx_conditions_card on conditions(card_id);
create index if not exists idx_options_card on options(card_id);
create index if not exists idx_effects_option on effects(option_id);
create index if not exists idx_global_stats_game on global_stats(game_id);
create index if not exists idx_world_states_game on world_states(game_id);
create index if not exists idx_flags_game on flags(game_id);
create index if not exists idx_deck_conditions_deck on deck_conditions(deck_id);

alter table games enable row level security;
alter table decks enable row level security;
alter table cards enable row level security;
alter table conditions enable row level security;
alter table options enable row level security;
alter table effects enable row level security;
alter table global_stats enable row level security;
alter table world_states enable row level security;
alter table flags enable row level security;
alter table deck_conditions enable row level security;
alter table game_logic_configs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'games' and policyname = 'allow_all_games'
  ) then
    create policy allow_all_games on games for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'decks' and policyname = 'allow_all_decks'
  ) then
    create policy allow_all_decks on decks for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cards' and policyname = 'allow_all_cards'
  ) then
    create policy allow_all_cards on cards for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'conditions' and policyname = 'allow_all_conditions'
  ) then
    create policy allow_all_conditions on conditions for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'options' and policyname = 'allow_all_options'
  ) then
    create policy allow_all_options on options for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'effects' and policyname = 'allow_all_effects'
  ) then
    create policy allow_all_effects on effects for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'global_stats' and policyname = 'allow_all_global_stats'
  ) then
    create policy allow_all_global_stats on global_stats for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'world_states' and policyname = 'allow_all_world_states'
  ) then
    create policy allow_all_world_states on world_states for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'flags' and policyname = 'allow_all_flags'
  ) then
    create policy allow_all_flags on flags for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'deck_conditions' and policyname = 'allow_all_deck_conditions'
  ) then
    create policy allow_all_deck_conditions on deck_conditions for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'game_logic_configs' and policyname = 'allow_all_game_logic_configs'
  ) then
    create policy allow_all_game_logic_configs on game_logic_configs for all using (true) with check (true);
  end if;
end $$;