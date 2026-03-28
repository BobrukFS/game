alter table cards
  alter column priority drop default,
  alter column priority drop not null;
