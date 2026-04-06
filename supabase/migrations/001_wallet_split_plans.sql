-- Run in Supabase SQL Editor or via CLI migrate.
-- Stores per-wallet split allocation (JSON) and optional balance snapshot at save time.

create table if not exists public.wallet_split_plans (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  config jsonb not null default '{}'::jsonb,
  balance_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_split_plans_address_hex check (wallet_address ~ '^0x[0-9a-fA-F]+$')
);

create unique index if not exists wallet_split_plans_wallet_address_key
  on public.wallet_split_plans (wallet_address);

comment on table public.wallet_split_plans is 'User-defined % split across stake / Vesu / cold / liquid; balance_snapshot captured when saved.';

-- Keep updated_at fresh on row changes
create or replace function public.set_wallet_split_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallet_split_plans_set_updated_at on public.wallet_split_plans;
create trigger wallet_split_plans_set_updated_at
  before update on public.wallet_split_plans
  for each row
  execute procedure public.set_wallet_split_plans_updated_at();

alter table public.wallet_split_plans enable row level security;

-- No policies: clients using the anon key cannot access this table.
-- Server routes should use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS on Supabase).
