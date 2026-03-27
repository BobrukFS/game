-- Move card weight to deck weight and add card type taxonomy.

alter table decks
  add column if not exists weight integer not null default 1;

alter table decks
  drop constraint if exists decks_weight_check;

alter table decks
  add constraint decks_weight_check check (weight > 0);

alter table cards
  add column if not exists type text not null default 'narrative';

-- Keep type constrained to known values to avoid inconsistent states.
alter table cards
  drop constraint if exists cards_type_check;

alter table cards
  add constraint cards_type_check check (type in ('decision', 'narrative', 'interactive'));

-- Card-level weight is no longer used.
alter table cards
  drop column if exists weight;
