create table if not exists game_logic_configs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references games(id) on delete cascade,
  counters jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb
);

alter table game_logic_configs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'game_logic_configs' and policyname = 'allow_all_game_logic_configs'
  ) then
    create policy allow_all_game_logic_configs on game_logic_configs for all using (true) with check (true);
  end if;
end $$;
