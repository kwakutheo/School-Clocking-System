Backend deployment and seeding
=============================

This document collects the exact commands and environment variables used to
deploy the backend to Render and seed a new, clean Supabase database using the
code-based seeder (multi-tenant aware). It purposely avoids applying old SQL
migration files that were written for a single-tenant schema.

1) Build locally (Windows PowerShell)

```powershell
cd backend
npm ci --legacy-peer-deps
npm run build
```

2) Run the code seeder against Supabase (will create the multi-tenant schema
and seed a default tenant + super-admin). Replace placeholders with real values.

PowerShell example:

```powershell
cd backend
$env:DB_HOST = 'miokputfdhvyarnkdpaj.supabase.co'
$env:DB_PORT = '5432'
$env:DB_USER = 'postgres'
$env:DB_PASS = 'Aythlus@sup86'
$env:DB_NAME = 'postgres'
$env:DB_SSL  = 'true'
node .\scratch\local_seed.js
```

- The seeder will create a default tenant (`slug: accra`), a super-admin user
  (username: `theo`, password: `112233`) and the role permissions matrix.
- After seeding, immediately change the seeded password.

3) Push code changes (so Render builds from the sanitized repo)

```bash
git add backend/package.json backend/Dockerfile backend/start.sh backend/remote_seed.js backend/src/app.module.ts backend/scratch/local_seed.js backend/firebase-service-account.example.json backend/DEPLOY.md
git commit -m "Prepare production deployment: DB SSL, safer seed scripts, start script"
git push origin <branch>
```

4) Render configuration

- Create a Web Service and point it to `backend` as the service root.
- Use the provided `Dockerfile` (Render will detect it automatically).
- Add the following Environment Variables in Render (replace values):

  - `NODE_ENV` = `production`
  - `PORT` = `3000`
  - `DB_HOST` = `<supabase-host>`
  - `DB_PORT` = `5432`
  - `DB_USER` = `postgres`
  - `DB_PASS` = `<supabase-db-password>`
  - `DB_NAME` = `postgres`
  - `DB_SSL`  = `true`
  - `JWT_SECRET` = `<generate-a-secret>`
  - `JWT_REFRESH_SECRET` = `<generate-a-secret>`
  - `JWT_EXPIRES_IN` = `8h`
  - `JWT_REFRESH_EXPIRES_IN` = `7d`
  - `CORS_ORIGIN` = `https://<your-frontend-domain>`

- If you need Firebase in production, add one of:
  - `FIREBASE_SERVICE_ACCOUNT_BASE64` = base64-encoded JSON, OR
  - `FIREBASE_SERVICE_ACCOUNT_JSON` = raw JSON string

- Health check path: `/health`

5) Seeding from Render (one-off)

If you prefer to seed from the Render environment (so the container uses the same
network and permissions), use the Render shell or a one-off job and run:

```bash
# inside Render shell with env vars already set
node scratch/local_seed.js
```

6) Vercel (frontend)

- Import the `dashboard` project in Vercel and set the project root to `dashboard`.
- Environment variables on Vercel:
  - `NEXT_PUBLIC_API_URL` = `https://<render-service>.onrender.com/api/v1`
  - (optional) `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

7) Verify

- Check health: `https://<render-service>/health` (HTTP 200)
- Open Swagger: `https://<render-service>/api/docs`
- Open the frontend and log in with the seeded super-admin, then change password.

Notes
-----
- Do NOT apply `backend/migrations/production_migration_v2.sql`. It is
  single-tenant SQL and will conflict with the current multi-tenant model.
- Rotate or remove any exposed credentials. The repo no longer contains the
  real Firebase service account; add it to Render as a secret instead.
