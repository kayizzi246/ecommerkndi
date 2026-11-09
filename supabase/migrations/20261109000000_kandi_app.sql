-- =============================================================================
--  Kandi app: Supabase schema
--
--  WooCommerce stays the shop's system of record. Products and categories are
--  COPIED here by the WordPress plugin kandi-supabase-sync.php (through the
--  `woo-sync` Edge Function), so the app reads them from Supabase quickly and
--  without loading WordPress. Orders go the other way: the app calls the
--  `place-order` Edge Function, which creates the real order in WooCommerce and
--  keeps a copy here for the shopper's order history and rewards.
--
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to run more than once.
--
--  THE APP NEEDS SEVEN TABLES
--    products         copy of WooCommerce products (filled by the sync)
--    categories       copy of WooCommerce categories (filled by the sync)
--    profiles         one per shopper: phone, name, points balance
--    addresses        each shopper's delivery addresses
--    orders           the app's copy of each WooCommerce order
--    points_ledger    every point earned, spent, returned
--    reward_settings  the points rules (one row, edit it in the table editor)
--
--  The cart is kept on the phone, so no cart table is needed. Tables this app
--  does not use (cart_items, wishlist, return_requests from a template) are
--  left alone; delete them later if nothing else uses them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Existing tables with the same names but a different shape
--
-- A template project may already have `products`, `orders` or `profiles` with
-- other columns. Those are RENAMED to *_old (nothing is deleted, the data is
-- still there) so the right tables can be created in their place. A table
-- that already has this app's shape is left exactly as it is.
-- ---------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('products', 'category_ids'),
      ('orders',   'woo_order_id'),
      ('profiles', 'points_balance'),
      ('categories', 'parent'),
      ('addresses', 'recipient')
    ) as wanted(tbl, marker)
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t.tbl)
       and not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = t.tbl and column_name = t.marker) then
      execute format('alter table public.%I rename to %I', t.tbl, t.tbl || '_old');
      raise notice 'Kept the old %.% as %_old', 'public', t.tbl, t.tbl;
    end if;
  end loop;
end $$;

-- A template's own "create a profile on sign-up" trigger would now write to the
-- new profiles table with columns it does not have, and break sign-in. Remove
-- any such trigger; this file installs its own (on_auth_user_created).
do $$
declare
  trg record;
begin
  for trg in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and t.tgname <> 'on_auth_user_created'
      and pg_get_functiondef(p.oid) ilike '%profiles%'
  loop
    execute format('drop trigger if exists %I on auth.users', trg.tgname);
    raise notice 'Removed old sign-up trigger %', trg.tgname;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Catalogue (written only by the woo-sync function, read by everyone)
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id                bigint primary key,            -- the WooCommerce product id
  name              text        not null,
  slug              text,
  price             numeric     not null default 0,
  regular_price     numeric     not null default 0,
  sale_price        numeric,
  on_sale           boolean     not null default false,
  featured          boolean     not null default false,
  stock_status      text        not null default 'instock',
  stock_quantity    integer,
  image             text,
  gallery           jsonb       not null default '[]'::jsonb,
  categories        jsonb       not null default '[]'::jsonb,   -- [{id, name, slug}]
  category_ids      bigint[]    not null default '{}',
  attributes        jsonb       not null default '[]'::jsonb,   -- [{name, options:[{name, value, image}]}]
  variations        jsonb       not null default '[]'::jsonb,   -- [{id, price, regular_price, attributes:{Size:"42"}, is_in_stock, image}]
  short_description text,
  description       text,
  average_rating    numeric     not null default 0,
  rating_count      integer     not null default 0,
  total_sales       integer     not null default 0,
  discount_percent  integer generated always as (
    case when regular_price > 0 and price < regular_price
      then floor((regular_price - price) * 100 / regular_price)::int else 0 end
  ) stored,
  date_created      timestamptz,
  synced_at         timestamptz not null default now()
);

create index if not exists products_category_ids_idx on public.products using gin (category_ids);
create index if not exists products_date_idx         on public.products (date_created desc);
create index if not exists products_sales_idx        on public.products (total_sales desc);
create index if not exists products_discount_idx     on public.products (discount_percent desc);

create table if not exists public.categories (
  id         bigint primary key,                    -- the WooCommerce term id
  name       text    not null,
  slug       text    not null unique,
  parent     bigint  not null default 0,
  count      integer not null default 0,
  image      text,
  synced_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shoppers
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  phone           text,
  full_name       text,
  points_balance  integer not null default 0 check (points_balance >= 0),
  created_at      timestamptz not null default now()
);

-- A profile for every new sign-in, carrying the verified phone number.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, coalesce(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label       text not null default 'Home',          -- Home, Work, …
  recipient   text not null,
  phone       text not null,
  street      text not null,                         -- street, building, house
  area        text,                                  -- Ntinda, Kira, …
  city        text not null default 'Kampala',
  landmark    text,
  lat         double precision,
  lng         double precision,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- Orders (written only by the place-order and woo-sync functions)
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  woo_order_id     bigint unique,
  status           text not null default 'creating',  -- creating | WooCommerce status | failed
  payment_method   text not null default 'cod',       -- cod | pesapal
  items            jsonb not null default '[]'::jsonb, -- snapshot: [{product_id, variation_id, name, image, options, quantity, price}]
  subtotal         numeric not null default 0,
  delivery_fee     numeric not null default 0,
  discount         numeric not null default 0,
  points_redeemed  integer not null default 0,
  points_earned    integer not null default 0,
  total            numeric not null default 0,
  currency         text not null default 'UGX',
  address          jsonb,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------

-- One row of settings, editable in the Supabase table editor.
create table if not exists public.reward_settings (
  id                  integer primary key default 1 check (id = 1),
  ugx_per_point       integer not null default 1000,  -- earn 1 point per UGX 1,000 of goods
  point_value_ugx     integer not null default 10,    -- 1 point = UGX 10 off (100 points = UGX 1,000)
  min_redeem_points   integer not null default 100,
  max_redeem_percent  integer not null default 50     -- points can pay at most half of the goods
);
insert into public.reward_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.points_ledger (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  order_id    uuid references public.orders (id) on delete set null,
  delta       integer not null,                     -- + earned / refunded, - redeemed / reversed
  reason      text not null,                        -- earned | redeemed | refund | reversed | adjust
  note        text,
  created_at  timestamptz not null default now(),
  unique (order_id, reason)                         -- each kind of entry at most once per order
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id, created_at desc);

-- Every ledger entry moves the balance. The balance cannot go below zero
-- (check constraint above), so redeeming more than you have fails cleanly.
create or replace function public.apply_points_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set points_balance = points_balance + new.delta where id = new.user_id;
  return new;
end $$;

drop trigger if exists points_ledger_apply on public.points_ledger;
create trigger points_ledger_apply
  after insert on public.points_ledger
  for each row execute function public.apply_points_ledger();

-- Order status drives points:
--   completed                       -> earn points on the goods paid for
--   cancelled / refunded / failed   -> give back any points that were spent,
--                                      and take back points earned on it
create or replace function public.order_status_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s       public.reward_settings;
  earned  integer;
begin
  if new.status = old.status then
    return new;
  end if;
  select * into s from public.reward_settings where id = 1;

  if new.status = 'completed' then
    earned := floor(greatest(new.subtotal - new.discount, 0) / greatest(s.ugx_per_point, 1));
    if earned > 0 then
      insert into public.points_ledger (user_id, order_id, delta, reason, note)
      values (new.user_id, new.id, earned, 'earned', 'Order delivered')
      on conflict (order_id, reason) do nothing;
      update public.orders set points_earned = earned where id = new.id;
    end if;
  elsif new.status in ('cancelled', 'refunded', 'failed') then
    if new.points_redeemed > 0 then
      insert into public.points_ledger (user_id, order_id, delta, reason, note)
      values (new.user_id, new.id, new.points_redeemed, 'refund', 'Order ' || new.status)
      on conflict (order_id, reason) do nothing;
    end if;
    if new.points_earned > 0 then
      insert into public.points_ledger (user_id, order_id, delta, reason, note)
      values (new.user_id, new.id, -least(new.points_earned,
              (select points_balance from public.profiles where id = new.user_id)), 'reversed', 'Order ' || new.status)
      on conflict (order_id, reason) do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_status_points on public.orders;
create trigger orders_status_points
  after update of status on public.orders
  for each row execute function public.order_status_points();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: who may read and write what
-- ---------------------------------------------------------------------------

alter table public.products        enable row level security;
alter table public.categories      enable row level security;
alter table public.profiles        enable row level security;
alter table public.addresses       enable row level security;
alter table public.orders          enable row level security;
alter table public.reward_settings enable row level security;
alter table public.points_ledger   enable row level security;

-- Anyone may browse the catalogue and read the reward rules.
drop policy if exists "catalogue is public" on public.products;
create policy "catalogue is public" on public.products for select using (true);
drop policy if exists "categories are public" on public.categories;
create policy "categories are public" on public.categories for select using (true);
drop policy if exists "reward rules are public" on public.reward_settings;
create policy "reward rules are public" on public.reward_settings for select using (true);

-- A shopper sees and edits only their own profile (name only; points are
-- moved by the ledger, never by the app).
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile name" on public.profiles;
create policy "own profile name" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- Addresses: full control over your own.
drop policy if exists "own addresses" on public.addresses;
create policy "own addresses" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Orders and points: read your own. Writes only through the Edge Functions,
-- which use the service role and bypass these rules.
drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders for select using (auth.uid() = user_id);
drop policy if exists "own points" on public.points_ledger;
create policy "own points" on public.points_ledger for select using (auth.uid() = user_id);
