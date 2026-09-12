# HackCMU

Mobile-first Next.js skeleton for a real-time interactive web app (sessions, rooms, live boards). Built with the App Router, TypeScript, Tailwind CSS, and a Supabase client stub.

## Local setup

1. Install Node.js 20+ and npm.
2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in your Supabase project URL and anon key from the [Supabase dashboard](https://supabase.com/dashboard) (free tier is enough).
4. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The lobby lives at `/dashboard`. The stub API route is `POST`/`GET` `/api/core-logic`.

## Supabase environment variables

Add these to `.env.local` locally, and to every Vercel environment (Production, Preview, Development):

| Variable | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe to expose in the client) |

Never commit `.env.local`. Keep service-role keys off `NEXT_PUBLIC_` prefixes and out of this repo.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/new), import the repo. Framework preset: **Next.js**.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Vercel will run `next build` automatically.

CLI alternative after `npm i -g vercel`:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel --prod
```
