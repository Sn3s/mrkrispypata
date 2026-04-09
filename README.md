<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7b1c2190-6e51-46f7-be52-8117720afa94

## Run Locally

**Prerequisites:** Node.js, a [Supabase](https://supabase.com) project

1. Install dependencies: `npm install`
2. In the Supabase dashboard, open **SQL Editor** and run **`supabase/APPLY_ALL.sql`** in one paste (or run `supabase/migrations/` files in order). This creates tables, RLS, seed data, the `create_customer_order` RPC, realtime on `orders`, and the profile `is_admin` lock trigger.
3. Create an **Auth** user (Authentication → Users → Add user). Copy their UUID, then run:
   `update public.profiles set is_admin = true where id = 'PASTE_USER_UUID_HERE';`
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**.
5. Optional: set `GEMINI_API_KEY` in `.env.local` if you use Gemini features.
6. Run the app: `npm run dev`

**Behavior:** The storefront loads branches, menu, and promos from Supabase; checkout calls `create_customer_order` (Haversine “closest branch” uses live coordinates + branch lat/lng from the DB). Admin sign-in uses Supabase Auth; CRUD and order status updates respect Row Level Security for users with `profiles.is_admin = true`.
