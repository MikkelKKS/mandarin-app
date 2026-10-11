# One-time setup

## Hosting (GitHub Pages)

1. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Every push to `main` builds, tests and deploys the app.

## Sync (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com) (Free plan, European region).
2. **Authentication → URL Configuration**: set the Site URL to the app's address, and add `<app address>/**` under Redirect URLs.
3. **SQL Editor → New query**: paste `supabase/migrations/001_init.sql` and run it. It's safe to run again.
4. Put the Project URL and the anon/publishable key in `.env.production`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable key>
   ```
   Both are public by design. Row-level security restricts every row to its owner.
5. In the app: **Settings → Sync between devices**, sign in with the email link on each device.

Free Supabase projects pause after about a week without use. The app keeps working offline; resume the project in the Supabase dashboard to sync again.

## Installing the app

- **Android (Chrome or Firefox):** open the app, menu ⋮ → Install / Add to Home screen.
- **Windows (Chrome or Edge):** install icon in the address bar. **Firefox 143+ on Windows:** the web app icon in the address bar.

## Development note

The `deps-snapshot` workflow stores a copy of `node_modules` on the `deps-cache` branch. It exists for sandboxed coding agents that can't reach the npm registry, and can be ignored otherwise.
