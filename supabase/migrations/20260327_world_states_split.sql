-- Separate world state from global stats.

create table if not exists world_states (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  key text not null,
  value_type text not null,
  value text not null,
  unique(game_id, key)
);

create index if not exists idx_world_states_game on world_states(game_id);

alter table world_states enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'world_states' and policyname = 'allow_all_world_states'
  ) then
    create policy allow_all_world_states on world_states for all using (true) with check (true);
  end if;
end $$;

insert into world_states (game_id, key, value_type, value)
select game_id, key, 'number' as value_type, value::text
from global_stats
where key like 'world.%' or key like 'interactions.%'
on conflict (game_id, key) do nothing;

delete from global_stats
where key like 'world.%' or key like 'interactions.%';
