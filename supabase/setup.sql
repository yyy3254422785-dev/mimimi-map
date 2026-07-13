-- Run this once in Supabase Dashboard -> SQL Editor.

create table if not exists public.shiba_state (
  id bigint primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- The browser must not access this table directly. Only the Express backend
-- uses the Supabase secret key, so no public RLS policy is created.
alter table public.shiba_state enable row level security;

insert into public.shiba_state (id, state, updated_at)
values (
  1,
  jsonb_build_object(
    'tasks', '[]'::jsonb,
    'currentTaskId', null,
    'timer', jsonb_build_object(
      'selectedMinutes', 25,
      'remainingSeconds', 1500,
      'status', 'ready'
    ),
    'updatedAt', to_jsonb(now())
  ),
  now()
)
on conflict (id) do nothing;
