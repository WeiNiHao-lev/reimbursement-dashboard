# Deploy Instructions

## 1. Supabase Setup (optional — for saving history)

1. Go to https://supabase.com and open your project
2. Run this SQL in the SQL editor:

```sql
create table reimbursements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  employee_name text,
  month text,
  trip_type text,
  purpose text,
  total_amount bigint,
  form_data jsonb
);
```

3. Copy your project URL and anon key from Settings > API

## 2. Vercel Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project folder
cd reimbursement-dashboard
vercel

# Follow prompts, then set environment variables:
vercel env add ANTHROPIC_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Redeploy with env vars
vercel --prod
```

## 3. Environment Variables

| Variable | Where to get |
|----------|-------------|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API > service_role |

## Local Development

```bash
# Fill in .env.local with your keys, then:
npm run dev
# Open http://localhost:3000
```
