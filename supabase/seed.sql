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
