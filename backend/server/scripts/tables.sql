-- Tables of the visitor side. Run once in the Supabase SQL Editor.
-- Until they exist, scripts/seed.js skips them and fills everything else.

create table if not exists route_requests (
  id bigint generated always as identity primary key,
  building_id uuid not null references buildings(id) on delete cascade,
  from_node text not null,
  to_node text not null,
  path jsonb not null,
  search_query text,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id bigint generated always as identity primary key,
  building_id uuid not null references buildings(id) on delete cascade,
  title text not null,
  category text not null,
  is_simulation boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- A visitor asks to become a building manager. We approve by hand, in the users table.
create table if not exists owner_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  full_name text not null,
  phone text,
  building_name text not null,
  building_type text not null check (building_type in ('mall', 'hospital', 'campus', 'office', 'other')),
  city text not null,
  message text,
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now()
);

create table if not exists chat_bans (
  id bigint generated always as identity primary key,
  building_id uuid not null references buildings(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (building_id, user_id)
);
