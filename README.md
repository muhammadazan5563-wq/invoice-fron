# Aqua Ledger — Vercel dashboard + Railway PostgreSQL server

This is now a full client/server application:

- **Vercel:** React/Vite dashboard only.
- **Railway:** Express server containing authentication, sessions, contacts, invoices, vendor invoices, settings, ledger, public invoice lookup, and Google Sheets proxy routes.
- **PostgreSQL:** The only application database. The backend uses the `pg` driver directly; Supabase is not used.
- **Automatic database setup:** Railway runs `backend/schema.sql` before the HTTP server starts. Every table and index is created with `IF NOT EXISTS`.

## Tables created automatically

`contacts`, `users`, `sessions`, `invoices`, `vendor_invoices`, `user_settings`, `ledger_invoices`, and `cash_expenses`.

## Railway deployment

1. Create a Railway project.
2. Add a **PostgreSQL** service/plugin to the project.
3. Deploy the `backend/` directory from the backend ZIP or from this repository with the service root set to `backend`.
4. Railway must provide `DATABASE_URL`. If it does not, copy the PostgreSQL service's connection string into the API service Variables.
5. Add:

   ```env
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   FRONTEND_ORIGIN=https://your-frontend.vercel.app
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=replace-with-a-strong-password
   ADMIN_BOOTSTRAP_SECRET=replace-with-a-random-secret
   ```

6. Deploy. The startup command is `npm start`.
7. On every deployment, the server executes `backend/schema.sql` first, then listens on Railway's `PORT`.
8. Generate a Railway public domain and verify:

   ```bash
   curl https://YOUR_RAILWAY_DOMAIN/health
   ```

   Expected response:

   ```json
   {"status":"ok","service":"invoice-api","database":"postgresql"}
   ```

### Create the first administrator

After deployment, call this once using the bootstrap secret:

```bash
curl -X POST https://YOUR_RAILWAY_DOMAIN/api/auth/bootstrap-admin \
  -H 'Content-Type: application/json' \
  -H 'X-Bootstrap-Secret: replace-with-a-random-secret' \
  -d '{"email":"admin@example.com","password":"replace-with-a-strong-password"}'
```

The admin then signs in from the Vercel dashboard using email and password. Vendor and customer accounts are created from the Contacts screen and are stored in PostgreSQL.

## Vercel deployment

1. Deploy the frontend ZIP's `frontend/` directory to Vercel.
2. Set this Vercel variable for Production, Preview, and Development:

   ```env
   VITE_API_URL=https://YOUR_RAILWAY_DOMAIN
   ```

3. Redeploy after adding the variable.
4. Set Railway `FRONTEND_ORIGIN` to the exact Vercel origin.

## Local development

Backend:

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL to a local/external PostgreSQL connection string
npm install
npm start
```

Frontend:

```bash
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8080
npm install
npm run dev
```

The server creates the tables automatically on startup locally as well.

## Security notes

- Never commit `.env` files or database passwords.
- Use Railway's private PostgreSQL connection variable instead of putting database credentials in Vercel.
- Change the bootstrap password and secret after the first admin is created.
- The frontend no longer contains Firebase or Supabase clients. All business data and account operations go through the Railway server.
