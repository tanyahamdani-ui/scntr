-- =====================================================================
-- SCNTR — Skema Database Pantau Kompetitor (Supabase / Postgres)
-- =====================================================================
-- Cara pakai: buka Supabase Dashboard -> SQL Editor -> New query,
-- tempel seluruh isi file ini, lalu Run. Aman dijalankan ulang.
-- 
-- Model datanya: satu pembeli = satu WORKSPACE. Semua data kerja
-- (competitor, snapshot, posts) nempel ke workspace_id.
-- Yang jagain pemisahan data antar pembeli adalah Row Level Security
-- di bawah — bukan kode frontend, yang bisa dibongkar siapa saja.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUM untuk kompetitor
-- ---------------------------------------------------------------------
do $$ begin
  create type competitor_format as enum ('video', 'image', 'carousel');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- TABEL KOMPETITOR
-- ---------------------------------------------------------------------
create table if not exists competitor_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  handle text not null,
  name text,
  url text,
  active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, handle)
);

create table if not exists competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references competitor_accounts(id) on delete cascade,
  taken_at date not null,
  followers int default 0,
  posts_count int default 0,
  avg_views_10 int default 0,
  median_views_10 int default 0,
  avg_likes_10 int default 0,
  engagement_rate numeric(5,2) default 0.00,
  created_at timestamptz not null default now(),
  unique (account_id, taken_at)
);

create table if not exists competitor_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references competitor_accounts(id) on delete cascade,
  url text unique not null,
  posted_at timestamptz not null,
  views int default 0,
  likes int default 0,
  comments int default 0,
  caption text,
  format competitor_format default 'video',
  seen_at timestamptz not null default now(),
  unique (account_id, url)
);

-- ---------------------------------------------------------------------
-- FUNGSI BANTU UNTUK RLS
-- ---------------------------------------------------------------------
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members m
                 where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function public.can_edit(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_role(ws, array['owner','admin','specialist','approver']::member_role[]);
$$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table competitor_accounts enable row level security;
alter table competitor_snapshots enable row level security;
alter table competitor_posts enable row level security;

drop policy if exists competitor_accounts_read on competitor_accounts;
create policy competitor_accounts_read on competitor_accounts for select using (is_member(workspace_id));
drop policy if exists competitor_accounts_write on competitor_accounts;
create policy competitor_accounts_write on competitor_accounts for all
  using (can_edit(workspace_id)) with check (can_edit(workspace_id));

drop policy if exists competitor_snapshots_read on competitor_snapshots;
create policy competitor_snapshots_read on competitor_snapshots for select using (is_member(workspace_id));
drop policy if exists competitor_snapshots_write on competitor_snapshots;
create policy competitor_snapshots_write on competitor_snapshots for all
  using (can_edit(workspace_id)) with check (can_edit(workspace_id));

drop policy if exists competitor_posts_read on competitor_posts;
create policy competitor_posts_read on competitor_posts for select using (is_member(workspace_id));
drop policy if exists competitor_posts_write on competitor_posts;
create policy competitor_posts_write on competitor_posts for all
  using (can_edit(workspace_id)) with check (can_edit(workspace_id));

-- ---------------------------------------------------------------------
-- TRIGGER: updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['competitor_accounts', 'competitor_snapshots', 'competitor_posts']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$s', t);
    execute format('create trigger trg_touch_%1$s before update on %1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;