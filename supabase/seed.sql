insert into decks (id, name, type, description) values
('00000000-0000-0000-0000-000000000101', 'Town Stories', 'story', 'Main narrative deck'),
('00000000-0000-0000-0000-000000000102', 'Traveling Merchant', 'shop', 'Shop encounters')
on conflict (id) do nothing;

insert into cards (id, deck_id, title, description, weight, priority, tags) values
('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'A Strange Whisper', 'You hear a whisper from the old well.', 3, 0, '{mystery,intro}'),
('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'Shadows at Noon', 'The market goes silent as shadows stretch.', 1, 1, '{story,danger}'),
('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000102', 'Merchant Offer', 'A peddler offers a vial with black liquid.', 2, 0, '{shop}')
on conflict (id) do nothing;

insert into conditions (id, card_id, type, key, value) values
('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000202', 'stat_min', 'lucidity', '3'),
('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000203', 'stat_max', 'suspicion', '5')
on conflict (id) do nothing;

insert into options (id, card_id, text, "order") values
('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000201', 'Look inside', 1),
('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000201', 'Walk away', 2),
('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000202', 'Confront the crowd', 1),
('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000203', 'Buy the vial', 1)
on conflict (id) do nothing;

insert into effects (id, option_id, type, key, value) values
('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000401', 'modify_stat', 'suspicion', '1'),
('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000402', 'modify_stat', 'lucidity', '-1'),
('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000404', 'add_item', 'inventory', 'black tongue')
on conflict (id) do nothing;

insert into global_stats (id, key, value, min, max) values
('00000000-0000-0000-0000-000000000601', 'gold', 5, 0, 99),
('00000000-0000-0000-0000-000000000602', 'suspicion', 1, 0, 10),
('00000000-0000-0000-0000-000000000603', 'lucidity', 4, 0, 10)
on conflict (id) do nothing;