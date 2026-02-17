-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Profiles table (auto-created on sign-up)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Tasks table
create table public.tasks (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  text text not null,
  completed boolean not null default false,
  pomodoros_spent integer not null default 0,
  scheduled_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_user_date_idx on public.tasks (user_id, scheduled_date);

alter table public.tasks enable row level security;

create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- 3. Daily stats table
create table public.daily_stats (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  total_focus_minutes integer not null default 0,
  sessions_completed integer not null default 0,
  unique (user_id, date)
);

create index daily_stats_user_date_idx on public.daily_stats (user_id, date);

alter table public.daily_stats enable row level security;

create policy "Users can view own stats"
  on public.daily_stats for select
  using (auth.uid() = user_id);

create policy "Users can insert own stats"
  on public.daily_stats for insert
  with check (auth.uid() = user_id);

create policy "Users can update own stats"
  on public.daily_stats for update
  using (auth.uid() = user_id);
