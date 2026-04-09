-- Add menu categories + recommended flag; replace catalog with printed Mr. Krispy menu (runs once per migration history)

alter table public.menu_items add column if not exists category text not null default 'Other';
alter table public.menu_items add column if not exists is_recommended boolean not null default false;

truncate table public.menu_items;

insert into public.menu_items (id, name, description, price_cents, image_url, active, category, is_recommended)
values
('e1e00000-0000-4000-8000-000000000001'::uuid, $$REGULAR PATA (2 pax)$$, $$$$, 55000, 'https://images.pexels.com/photos/62097/pexels-photo-62097.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, false),
  ('e1e00000-0000-4000-8000-000000000002'::uuid, $$JUMBO PATA (3-4 pax)$$, $$Customer favorite$$, 60000, 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, true),
  ('e1e00000-0000-4000-8000-000000000003'::uuid, $$MEGA PATA (5-6 pax)$$, $$$$, 75000, 'https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, false),
  ('e1e00000-0000-4000-8000-000000000004'::uuid, $$KRISPY ULO$$, $$Customer favorite$$, 60000, 'https://images.pexels.com/photos/236487/pexels-photo-236487.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, true),
  ('e1e00000-0000-4000-8000-000000000005'::uuid, $$KRISPY LIEMPO$$, $$$$, 25000, 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, false),
  ('e1e00000-0000-4000-8000-000000000006'::uuid, $$KRISPY CHICKEN (whole)$$, $$$$, 35000, 'https://images.pexels.com/photos/60616/pexels-photo-60616.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, false),
  ('e1e00000-0000-4000-8000-000000000007'::uuid, $$CHICHARON BULAKLAK$$, $$$$, 23500, 'https://images.pexels.com/photos/1870516/pexels-photo-1870516.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, false),
  ('e1e00000-0000-4000-8000-000000000008'::uuid, $$PORK SISIG$$, $$Customer favorite$$, 23500, 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Main$$, true),
  ('e1e00000-0000-4000-8000-000000000009'::uuid, $$CHOPSUEY$$, $$Customer favorite$$, 25500, 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Veggies and Noodles$$, true),
  ('e1e00000-0000-4000-8000-000000000010'::uuid, $$PINAKBET$$, $$$$, 25500, 'https://images.pexels.com/photos/1640773/pexels-photo-1640773.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Veggies and Noodles$$, false),
  ('e1e00000-0000-4000-8000-000000000011'::uuid, $$PANCIT CANTON$$, $$Customer favorite$$, 32000, 'https://images.pexels.com/photos/725997/pexels-photo-725997.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Veggies and Noodles$$, true),
  ('e1e00000-0000-4000-8000-000000000012'::uuid, $$PANCIT BIHON$$, $$$$, 32000, 'https://images.pexels.com/photos/1907228/pexels-photo-1907228.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Veggies and Noodles$$, false),
  ('e1e00000-0000-4000-8000-000000000013'::uuid, $$PLAIN RICE (PER CUP)$$, $$$$, 3000, 'https://images.pexels.com/photos/674574/pexels-photo-674574.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Rice$$, false),
  ('e1e00000-0000-4000-8000-000000000014'::uuid, $$GARLIC RICE (PER CUP)$$, $$$$, 4000, 'https://images.pexels.com/photos/674680/pexels-photo-674680.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Rice$$, false),
  ('e1e00000-0000-4000-8000-000000000015'::uuid, $$MR. KRISPY FRIED RICE$$, $$Customer favorite$$, 37000, 'https://images.pexels.com/photos/842142/pexels-photo-842142.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Rice$$, true),
  ('e1e00000-0000-4000-8000-000000000016'::uuid, $$Sukang Masarap 350 mL$$, $$$$, 8500, 'https://images.pexels.com/photos/3373745/pexels-photo-3373745.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Extras$$, false),
  ('e1e00000-0000-4000-8000-000000000017'::uuid, $$Sukang Masarap 500 mL$$, $$$$, 10000, 'https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Extras$$, false),
  ('e1e00000-0000-4000-8000-000000000018'::uuid, $$Sukang Masarap 1L$$, $$$$, 13000, 'https://images.pexels.com/photos/3373745/pexels-photo-3373745.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Extras$$, false),
  ('e1e00000-0000-4000-8000-000000000019'::uuid, $$KRISPY LIEMPO KARE-KARE$$, $$Customer favorite$$, 36000, 'https://images.pexels.com/photos/3659862/pexels-photo-3659862.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Specials (3-5 PAX)$$, true),
  ('e1e00000-0000-4000-8000-000000000020'::uuid, $$PORK BINAGOONGAN$$, $$$$, 35000, 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Specials (3-5 PAX)$$, false),
  ('e1e00000-0000-4000-8000-000000000021'::uuid, $$TOKWA'T BABOY$$, $$$$, 27500, 'https://images.pexels.com/photos/3023478/pexels-photo-3023478.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Specials (3-5 PAX)$$, false),
  ('e1e00000-0000-4000-8000-000000000022'::uuid, $$PORK SHANGHAI$$, $$$$, 24000, 'https://images.pexels.com/photos/6210746/pexels-photo-6210746.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Specials (3-5 PAX)$$, false),
  ('e1e00000-0000-4000-8000-000000000023'::uuid, $$SISIG BANGUS$$, $$Customer favorite$$, 23500, 'https://images.pexels.com/photos/725998/pexels-photo-725998.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Specials (3-5 PAX)$$, true),
  ('e1e00000-0000-4000-8000-000000000024'::uuid, $$BONELESS BANGUS$$, $$$$, 20000, 'https://images.pexels.com/photos/1647163/pexels-photo-1647163.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Specials (3-5 PAX)$$, false),
  ('e1e00000-0000-4000-8000-000000000025'::uuid, $$SINIGANG NA LIEMPO$$, $$$$, 35000, 'https://images.pexels.com/photos/3622474/pexels-photo-3622474.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Soup$$, false),
  ('e1e00000-0000-4000-8000-000000000026'::uuid, $$SINIGANG NA HIPON$$, $$Customer favorite$$, 38000, 'https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Soup$$, true),
  ('e1e00000-0000-4000-8000-000000000027'::uuid, $$Sizzling Pork Sisig$$, $$$$, 17000, 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Combo Meals$$, false),
  ('e1e00000-0000-4000-8000-000000000028'::uuid, $$Sizzling Sisig Bangus$$, $$$$, 17000, 'https://images.pexels.com/photos/725998/pexels-photo-725998.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Combo Meals$$, false),
  ('e1e00000-0000-4000-8000-000000000029'::uuid, $$Chicharon Bulaklak$$, $$$$, 17000, 'https://images.pexels.com/photos/1870516/pexels-photo-1870516.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Combo Meals$$, false),
  ('e1e00000-0000-4000-8000-000000000030'::uuid, $$Krispy Liempo$$, $$$$, 18000, 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Combo Meals$$, false),
  ('e1e00000-0000-4000-8000-000000000031'::uuid, $$Fried Daing Bangus$$, $$$$, 19000, 'https://images.pexels.com/photos/725998/pexels-photo-725998.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Combo Meals$$, false),
  ('e1e00000-0000-4000-8000-000000000032'::uuid, $$Half Fried Chicken$$, $$$$, 28500, 'https://images.pexels.com/photos/60616/pexels-photo-60616.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Combo Meals$$, false),
  ('e1e00000-0000-4000-8000-000000000033'::uuid, $$Iced Tea (Pitcher)$$, $$$$, 15000, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Drinks$$, false),
  ('e1e00000-0000-4000-8000-000000000034'::uuid, $$Softdrinks (1.5 L)$$, $$$$, 12000, 'https://images.pexels.com/photos/4393021/pexels-photo-4393021.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Drinks$$, false),
  ('e1e00000-0000-4000-8000-000000000035'::uuid, $$Softdrinks Mismo$$, $$$$, 3000, 'https://images.pexels.com/photos/4393188/pexels-photo-4393188.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Drinks$$, false),
  ('e1e00000-0000-4000-8000-000000000036'::uuid, $$Coke Zero in can$$, $$$$, 5000, 'https://images.pexels.com/photos/4393197/pexels-photo-4393197.jpeg?auto=compress&cs=tinysrgb&w=800', true, $$Drinks$$, false)
