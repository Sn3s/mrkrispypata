-- Mr. K restaurant SaaS — run in Supabase SQL Editor or via `supabase db push`

-- Extensions
create extension if not exists "pgcrypto";

-- ---------- Branches ----------
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  phone text,
  hours text,
  status_customer text not null default 'Open Now',
  status_admin text not null default 'Open' check (status_admin in ('Open', 'Closed')),
  lat double precision not null,
  lng double precision not null,
  manager_name text,
  system_load int not null default 0 check (system_load >= 0 and system_load <= 100),
  monthly_revenue_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Catalog ----------
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  image_url text,
  active boolean not null default true,
  category text not null default 'Other',
  is_recommended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.promos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  tag text,
  price_label text,
  price_cents int,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Orders ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  status text not null default 'PREP' check (status in ('PREP', 'DONE', 'PICKUP', 'DELIVERING')),
  subtotal_cents int not null,
  delivery_fee_cents int not null default 4900,
  total_cents int not null,
  created_at timestamptz not null default now()
);

create table public.order_line_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  name text not null,
  unit_price_cents int not null,
  quantity int not null check (quantity > 0),
  image_url text
);

create index order_line_items_order_id_idx on public.order_line_items (order_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_branch_id_idx on public.orders (branch_id);

-- ---------- Ops ----------
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches (id) on delete cascade,
  name text not null,
  stock_level int not null,
  threshold int not null,
  created_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete cascade,
  name text not null,
  role text not null,
  performance real not null default 4.5,
  status text not null default 'Active',
  photo_seed text,
  created_at timestamptz not null default now()
);

-- ---------- Profiles (links to auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  display_name text,
  updated_at timestamptz not null default now()
);

-- New user → profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, is_admin)
  values (new.id, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- Admin check ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------- Customer order RPC (atomic) ----------
create or replace function public.create_customer_order(
  p_branch_id uuid,
  p_items jsonb,
  p_delivery_fee_cents int default 4900
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_subtotal int := 0;
  el jsonb;
  v_qty int;
  v_unit int;
begin
  if not exists (select 1 from public.branches b where b.id = p_branch_id) then
    raise exception 'invalid_branch';
  end if;

  for el in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_unit := greatest(0, coalesce((el->>'unit_price_cents')::int, 0));
    v_qty := greatest(1, least(99, coalesce((el->>'quantity')::int, 1)));
    if length(trim(coalesce(el->>'name', ''))) = 0 then
      raise exception 'item_name_required';
    end if;
    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  insert into public.orders (branch_id, status, subtotal_cents, delivery_fee_cents, total_cents)
  values (p_branch_id, 'PREP', v_subtotal, p_delivery_fee_cents, v_subtotal + p_delivery_fee_cents)
  returning id into v_order_id;

  for el in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_unit := greatest(0, coalesce((el->>'unit_price_cents')::int, 0));
    v_qty := greatest(1, least(99, coalesce((el->>'quantity')::int, 1)));
    insert into public.order_line_items (order_id, name, unit_price_cents, quantity, image_url)
    values (
      v_order_id,
      left(trim(el->>'name'), 200),
      v_unit,
      v_qty,
      nullif(trim(el->>'image_url'), '')
    );
  end loop;

  return v_order_id;
end;
$$;

grant usage on schema public to anon, authenticated;

grant execute on function public.create_customer_order(uuid, jsonb, int) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- RLS ----------
alter table public.branches enable row level security;
alter table public.menu_items enable row level security;
alter table public.promos enable row level security;
alter table public.orders enable row level security;
alter table public.order_line_items enable row level security;
alter table public.inventory enable row level security;
alter table public.staff enable row level security;
alter table public.profiles enable row level security;

-- Branches: public read; admin write
create policy branches_select_public on public.branches for select using (true);
create policy branches_insert_admin on public.branches for insert with check (public.is_admin());
create policy branches_update_admin on public.branches for update using (public.is_admin());
create policy branches_delete_admin on public.branches for delete using (public.is_admin());

-- Menu: active for guests; admins see all
create policy menu_select on public.menu_items for select using (active = true or public.is_admin());
create policy menu_write_admin on public.menu_items for all using (public.is_admin()) with check (public.is_admin());

-- Promos
create policy promos_select on public.promos for select using (active = true or public.is_admin());
create policy promos_write_admin on public.promos for all using (public.is_admin()) with check (public.is_admin());

-- Orders (no direct insert from clients)
create policy orders_select_admin on public.orders for select using (public.is_admin());
create policy orders_update_admin on public.orders for update using (public.is_admin());

create policy order_lines_select_admin on public.order_line_items for select using (public.is_admin());

-- Inventory & staff: admin only
create policy inventory_all_admin on public.inventory for all using (public.is_admin()) with check (public.is_admin());
create policy staff_all_admin on public.staff for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: users read/update own; insert handled by trigger
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.orders;

-- ---------- Seed (idempotent-ish: skip if branches exist) ----------
insert into public.branches (id, name, address, phone, hours, status_customer, status_admin, lat, lng, manager_name, system_load, monthly_revenue_cents)
select * from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Sta. Cruz', '123 Rizal Ave, Sta. Cruz, Manila', '(02) 888-1234', '10 AM - 10 PM', 'Open Now', 'Open', 14.6186, 120.9847, 'Ricardo D.', 85, 24500000),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Binondo Flagship', '456 Quintin Paredes, Binondo', '(02) 888-5678', '9 AM - 11 PM', 'Open Now', 'Open', 14.5995, 120.9753, 'Liza M.', 92, 81200000),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Makati Central', 'Salcedo Village, Makati', '(02) 888-9900', '10 AM - 9 PM', 'Open Now', 'Open', 14.5547, 121.0244, 'Santi P.', 78, 56000000),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'BGC Express', 'High Street, BGC, Taguig', '(02) 888-1122', '11 AM - 10 PM', 'Closing Soon', 'Open', 14.5482, 121.0493, 'Kevin T.', 45, 43000000),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'Quezon City Hub', 'Katipunan Ave, Quezon City', '(02) 888-3344', '10 AM - 10 PM', 'Open Now', 'Open', 14.6760, 121.0437, 'Elena R.', 12, 12000000),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'Alabang Town', 'Commerce Ave, Muntinlupa', '(02) 888-7788', '10 AM - 9 PM', 'Open Now', 'Closed', 14.4245, 121.0412, 'Marco S.', 0, 0)
) as v(id, name, address, phone, hours, status_customer, status_admin, lat, lng, manager_name, system_load, monthly_revenue_cents)
where not exists (select 1 from public.branches limit 1);

insert into public.menu_items (id, name, description, price_cents, image_url, active, category, is_recommended)
select * from (values
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
) as v(id, name, description, price_cents, image_url, active, category, is_recommended)
where not exists (select 1 from public.menu_items limit 1);

insert into public.promos (id, title, description, tag, price_label, price_cents, image_url, active)
select * from (values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid, 'Weekend Barkada Treat', 'Enjoy a mix of our bestseller sides and 1 giant crispy pata at a special price.', 'Save 20%', '₱1,499', 149900, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid, 'Sizzling Sisig Topper', 'Add our award-winning sizzling pork sisig to any Crispy Pata order for only ₱199.', 'New Release', '₱199', 19900, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid, 'Free 1.5L Iced Tea', 'Get a free bottle of our signature house blend iced tea for orders above ₱2,500.', 'Freebie', 'FREE', 0, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=800', true)
) as v(id, title, description, tag, price_label, price_cents, image_url, active)
where not exists (select 1 from public.promos limit 1);

insert into public.inventory (id, branch_id, name, stock_level, threshold)
select * from (values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Crispy Pata (L)', 42, 50),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Pork Sisig Base', 12, 100),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'Cooking Oil (Bulk)', 85, 40),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4'::uuid, null::uuid, 'Iced Tea Mix', 156, 100),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc5'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'Packaging Box (M)', 24, 200)
) as v(id, branch_id, name, stock_level, threshold)
where not exists (select 1 from public.inventory limit 1);

insert into public.staff (id, branch_id, name, role, performance, status, photo_seed)
select * from (values
  ('f0000001-0000-4000-8000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Ricardo Dalisay', 'Branch Manager', 4.8::real, 'Active', 'Ricardo Dalisay'),
  ('f0000001-0000-4000-8000-000000000002'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Liza Manuel', 'Senior Chef', 4.9::real, 'Active', 'Liza Manuel'),
  ('f0000001-0000-4000-8000-000000000003'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'Kevin Tan', 'Supervisor', 4.2::real, 'On Break', 'Kevin Tan'),
  ('f0000001-0000-4000-8000-000000000004'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'Elena Reyes', 'Cashier', 3.8::real, 'Active', 'Elena Reyes'),
  ('f0000001-0000-4000-8000-000000000005'::uuid, '66666666-6666-6666-6666-666666666666'::uuid, 'Marco Santos', 'Delivery Lead', 4.5::real, 'Inactive', 'Marco Santos')
) as v(id, branch_id, name, role, performance, status, photo_seed)
where not exists (select 1 from public.staff limit 1);
-- Prevent clients from toggling is_admin on themselves (run after initial schema)

create or replace function public.protect_profile_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block self-elevation via the anon/authenticated API; SQL Editor runs with auth.uid() null.
  if auth.uid() is not null and tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin cannot be changed via the API';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_profiles_lock_is_admin on public.profiles;
create trigger tr_profiles_lock_is_admin
  before update on public.profiles
  for each row
  execute procedure public.protect_profile_is_admin();
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
-- PostgREST reads as anon/authenticated; ensure catalog tables are selectable (safe if already granted)
grant select on table public.branches to anon, authenticated;
grant select on table public.menu_items to anon, authenticated;
grant select on table public.promos to anon, authenticated;
-- Per-dish food images (Pexels)
update public.menu_items set image_url = 'https://images.pexels.com/photos/62097/pexels-photo-62097.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000001'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000002'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000003'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/236487/pexels-photo-236487.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000004'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000005'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/60616/pexels-photo-60616.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000006'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1870516/pexels-photo-1870516.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000007'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000008'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000009'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1640773/pexels-photo-1640773.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000010'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/725997/pexels-photo-725997.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000011'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1907228/pexels-photo-1907228.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000012'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/674574/pexels-photo-674574.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000013'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/674680/pexels-photo-674680.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000014'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/842142/pexels-photo-842142.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000015'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/3373745/pexels-photo-3373745.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000016'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000017'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/3373745/pexels-photo-3373745.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000018'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/3659862/pexels-photo-3659862.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000019'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000020'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/3023478/pexels-photo-3023478.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000021'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/6210746/pexels-photo-6210746.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000022'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/725998/pexels-photo-725998.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000023'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1647163/pexels-photo-1647163.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000024'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/3622474/pexels-photo-3622474.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000025'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000026'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000027'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/725998/pexels-photo-725998.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000028'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/1870516/pexels-photo-1870516.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000029'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000030'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/725998/pexels-photo-725998.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000031'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/60616/pexels-photo-60616.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000032'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000033'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/4393021/pexels-photo-4393021.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000034'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/4393188/pexels-photo-4393188.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000035'::uuid;
update public.menu_items set image_url = 'https://images.pexels.com/photos/4393197/pexels-photo-4393197.jpeg?auto=compress&cs=tinysrgb&w=800' where id = 'e1e00000-0000-4000-8000-000000000036'::uuid;

-- ---------- Optional: explicit WITH CHECK on order updates (helps some Postgres versions) ----------
drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Realtime: storefront live-refresh when admin edits menu / promos ----------
do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'menu_items'
  ) then
    alter publication supabase_realtime add table public.menu_items;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'promos'
  ) then
    alter publication supabase_realtime add table public.promos;
  end if;
end $pub$;
