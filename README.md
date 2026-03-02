# Kairos Billing & Plans

## Setup

1. Run Supabase migrations (includes plans, subscriptions, transactions, webhook event log, and plan resolution functions).
2. Seed plans:
   ```bash
   supabase db seed --file supabase/seed.sql
   ```
3. Configure environment variables from `.env.example`.
4. Create Stripe Product/Price for **CORE** monthly ($10) and set `STRIPE_CORE_PRICE_ID`.
5. Deploy edge functions:
   - `billing-checkout`
   - `billing-portal`
   - `billing-webhook`
   - `billing-set-free`
   - `project-pay`
   - `admin-billing`
6. Point Stripe webhook to `.../functions/v1/billing-webhook` and subscribe to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `charge.refunded`

## Plans

- `FREE`: $0/mo and configurable platform fee (`platform_fee_bps`), default 1000 bps (10%).
- `CORE`: $10/mo via Stripe subscription, 0% platform fee.
- `LIFETIME`: hidden by default, assign manually via admin page.

## UI Routes

- `/pricing`: Plan chooser (FREE and CORE only).
- `/billing`: Current plan + subscription details + billing portal button.
- `/admin/billing`: Admin controls for visibility, FREE fee %, and assigning LIFETIME.

## Entitlements

Plan entitlements are resolved server-side with `get_user_plan(user_id)` and enforced with a DB trigger:
- FREE: max 3 projects, exports disabled, no team seats.
- CORE/LIFETIME: unlimited projects, exports enabled, up to 5 team members.

## Payments + Revenue Share

Use the `project-pay` edge function to create Stripe PaymentIntents. On `payment_intent.succeeded`, the webhook computes:

```text
platform_fee_cents = round(amount_cents * platform_fee_bps / 10000)
net_amount_cents = amount_cents - platform_fee_cents
```

and records transactions idempotently using `stripe_payment_intent_id`.
