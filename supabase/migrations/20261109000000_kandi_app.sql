-- =============================================================================
--  Kandi app: Supabase schema
--
--  Supabase holds only a COPY of the WooCommerce catalogue for the app to read
--  quickly: products and categories, written by the WordPress plugin
--  kandi-supabase-sync.php through the `woo-sync` Edge Function. Sign-in is
--  Supabase Auth (Google). Accounts, addresses, orders and reward points live
--  in WooCommerce (wordpress/kandi-mobile-api.php), not here.
--
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to run more than once.
-- =============================================================================

-- A template project may already have `products` or `categories` with other
-- columns. Those are RENAMED to *_old (nothing is deleted) so the right tables
-- can be created in their place. A table that already has this shape is kept.
do $$
declare
  t record;
begin
  for t in
    select * from (values ('products', 'category_ids'), ('categories', 'parent')) as wanted(tbl, marker)
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t.tbl)
       and not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = t.tbl and column_name = t.marker) then
      execute format('alter table public.%I rename to %I', t.tbl, t.tbl || '_old');
      raise notice 'Kept the old % as %_old', t.tbl, t.tbl;
    end if;
  end loop;
end $$;

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

-- Anyone may browse the catalogue; only the woo-sync function (service role,
-- which bypasses these rules) writes to it.
alter table public.products   enable row level security;
alter table public.categories enable row level security;

drop policy if exists "catalogue is public" on public.products;
create policy "catalogue is public" on public.products for select using (true);
drop policy if exists "categories are public" on public.categories;
create policy "categories are public" on public.categories for select using (true);

-- ---------------------------------------------------------------------------
-- Optional clean-up. An earlier version of this file also created tables the
-- app no longer uses (accounts, addresses, orders and points moved to
-- WooCommerce). Nothing reads them; to remove them, run these lines on their
-- own:
--
--   drop table if exists public.points_ledger, public.reward_settings,
--     public.orders, public.addresses, public.profiles cascade;
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user, public.apply_points_ledger,
--     public.order_status_points, public.touch_updated_at;
-- ---------------------------------------------------------------------------
