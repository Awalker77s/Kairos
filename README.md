# Kairos

Kairos is an AI architectural visualization platform that converts natural-language design prompts into structured 2D floor plans and interactive 3D visualizations.

## Key Features

- **Prompt-to-plan generation:** Turn text descriptions into normalized floor plan JSON and rendered 2D plans.
- **Interactive 3D preview:** Generate 3D scenes from floor plan data for client walkthroughs.
- **Room renders:** Produce room-level AI renders from project context.
- **Project workspace:** Create, edit, save, and share design projects.
- **Usage controls and billing:** FREE/CORE/LIFETIME plans, Stripe checkout/portal, and admin billing controls.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router
- **3D/graphics:** three.js, @react-three/fiber, @react-three/drei
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **AI services:** OpenAI API (floor-plan and render generation workflows)
- **Payments:** Stripe subscriptions + payment intents

## Architecture Overview

- `src/` contains the Vite React app (routes, pages, UI components, client SDK helpers).
- `supabase/migrations/` defines database schema and billing logic.
- `supabase/functions/` contains Deno Edge Functions for AI generation, billing, and webhook processing.
- `tests/` contains Node test files for business rules.

## AI Pipeline Overview

1. User creates/opens a project in the dashboard.
2. **Step 1:** Frontend calls `generate-floor-plan` Edge Function with authenticated user context.
3. Function validates access, calls OpenAI, and stores structured floor-plan output.
4. **Step 2:** Frontend renders plan data into interactive 3D visualization.
5. **Step 3:** Frontend calls `generate-room-renders` to create room-level outputs.
6. Project status advances (`floor_plan` → `3d_model` → `rendered`) and can be shared/exported per plan entitlements.

## Run Locally

### Prerequisites

- Node.js 18+
- npm
- Supabase CLI (for local DB/functions workflow)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template and fill values:
   ```bash
   cp .env.example .env.local
   ```
3. Run the frontend:
   ```bash
   npm run dev
   ```
4. (Optional) Run tests:
   ```bash
   npm test
   ```

## Required Environment Variables

See `.env.example` for the complete list.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CORE_PRICE_ID`
- `APP_URL`
- `ADMIN_EMAILS`

## Deployment Notes

- Do **not** commit `.env*` files with real secrets.
- Configure all environment variables in your hosting providers (e.g., Vercel + Supabase project settings).
- Deploy required Supabase Edge Functions:
  - `generate-floor-plan`
  - `generate-room-renders`
  - `billing-checkout`
  - `billing-portal`
  - `billing-webhook`
  - `billing-set-free`
  - `project-pay`
  - `admin-billing`
- Configure Stripe webhook endpoint to `.../functions/v1/billing-webhook` with the expected billing events.
