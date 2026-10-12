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

create table if not exists chat_bans (
  id bigint generated always as identity primary key,
  building_id uuid not null references buildings(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (building_id, user_id)
);
