-- MediCore Pharmacy ERP — database schema
-- Run this once in Supabase SQL Editor

create table branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  manager text,
  phone text,
  opened date default current_date,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  batch text,
  expiry date,
  unit_price numeric default 0,
  reorder_level int default 10,
  created_at timestamptz default now()
);

create table stock_levels (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  branch_id uuid references branches(id) on delete cascade,
  quantity int default 0,
  unique(product_id, branch_id)
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  branch_id uuid references branches(id) on delete set null,
  phone text,
  joined date default current_date,
  shift text default 'Morning',
  status text default 'Active',
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table branches enable row level security;
alter table products enable row level security;
alter table stock_levels enable row level security;
alter table employees enable row level security;

-- Allow any logged-in user to read/write (single-tenant demo setup)
-- This is fine while it's one pharmacy with trusted staff logins.
create policy "Authenticated users can do everything on branches"
  on branches for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on products"
  on products for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on stock_levels"
  on stock_levels for all using (auth.role() = 'authenticated');
create policy "Authenticated users can do everything on employees"
  on employees for all using (auth.role() = 'authenticated');
