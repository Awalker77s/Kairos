create extension if not exists pgcrypto;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('FREE', 'CORE', 'LIFETIME')),
  name text not null,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  platform_fee_bps integer not null default 0 check (platform_fee_bps >= 0 and platform_fee_bps <= 10000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  stripe_payment_intent_id text unique,
  status text not null check (status in ('pending', 'succeeded', 'refunded')),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  net_amount_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_plan_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
  stripe_event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.user_plan_overrides enable row level security;

create policy if not exists "Plans are viewable by authenticated users"
  on public.plans for select
  using (auth.role() = 'authenticated');

create policy if not exists "Users can read their subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy if not exists "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy if not exists "Users can read own plan override"
  on public.user_plan_overrides for select
  using (auth.uid() = user_id);

create index if not exists idx_subscriptions_user_id_created_at on public.subscriptions (user_id, created_at desc);
create index if not exists idx_transactions_project_id_created_at on public.transactions (project_id, created_at desc);
create index if not exists idx_transactions_user_id_created_at on public.transactions (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
before update on public.subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists user_plan_overrides_touch_updated_at on public.user_plan_overrides;
create trigger user_plan_overrides_touch_updated_at
before update on public.user_plan_overrides
for each row execute function public.touch_updated_at();

insert into public.plans (code, name, monthly_price_cents, platform_fee_bps, is_visible)
values
  ('FREE', 'Free', 0, 1000, true),
  ('CORE', 'Core', 1000, 0, true),
  ('LIFETIME', 'Lifetime', 0, 0, false)
on conflict (code) do update
set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  platform_fee_bps = excluded.platform_fee_bps,
  is_visible = excluded.is_visible;

create or replace function public.get_user_plan(target_user_id uuid)
returns table (
  plan_code text,
  plan_name text,
  platform_fee_bps integer,
  subscription_status text,
  current_period_end timestamptz,
  max_projects integer,
  exports_enabled boolean,
  team_members integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  override_plan public.plans%rowtype;
  active_subscription record;
  free_plan public.plans%rowtype;
  resolved_code text;
  resolved_name text;
  resolved_bps integer;
  resolved_status text;
  resolved_period_end timestamptz;
begin
  select p.* into free_plan from public.plans p where p.code = 'FREE';

  select p.* into override_plan
  from public.user_plan_overrides upo
  join public.plans p on p.id = upo.plan_id
  where upo.user_id = target_user_id;

  if override_plan.id is not null then
    resolved_code := override_plan.code;
    resolved_name := override_plan.name;
    resolved_bps := override_plan.platform_fee_bps;
    resolved_status := 'active';
    resolved_period_end := null;
  else
    select s.id, s.status, s.current_period_end, p.code, p.name, p.platform_fee_bps
      into active_subscription
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.user_id = target_user_id
      and s.status in ('trialing', 'active', 'past_due')
    order by s.created_at desc
    limit 1;

    if active_subscription.id is not null then
      resolved_code := active_subscription.code;
      resolved_name := active_subscription.name;
      resolved_bps := active_subscription.platform_fee_bps;
      resolved_status := active_subscription.status;
      resolved_period_end := active_subscription.current_period_end;
    else
      resolved_code := free_plan.code;
      resolved_name := free_plan.name;
      resolved_bps := free_plan.platform_fee_bps;
      resolved_status := 'active';
      resolved_period_end := null;
    end if;
  end if;

  plan_code := resolved_code;
  plan_name := resolved_name;
  platform_fee_bps := resolved_bps;
  subscription_status := resolved_status;
  current_period_end := resolved_period_end;

  if resolved_code = 'FREE' then
    max_projects := 3;
    exports_enabled := false;
    team_members := 0;
  else
    max_projects := null;
    exports_enabled := true;
    team_members := 5;
  end if;

  return next;
end;
$$;

grant execute on function public.get_user_plan(uuid) to authenticated, service_role;

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_record record;
  project_count integer;
begin
  select * into plan_record from public.get_user_plan(new.user_id);

  if plan_record.max_projects is not null then
    select count(*) into project_count from public.projects p where p.user_id = new.user_id;
    if project_count >= plan_record.max_projects then
      raise exception 'Project limit reached for your current plan (%). Upgrade to create more projects.', plan_record.plan_code;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_enforce_limit_before_insert on public.projects;
create trigger projects_enforce_limit_before_insert
before insert on public.projects
for each row execute function public.enforce_project_limit();
