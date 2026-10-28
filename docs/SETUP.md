# One-time setup

Everything here has been done already; this is the record of it, for a rebuild.

## Hosting (GitHub Pages)

1. In the repository go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Every push to `main` builds, tests and deploys the app.

## Sync (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com) (Free plan, European region).
2. **Authentication → URL Configuration**: set the Site URL to the app's address, and add `<app address>/**` under Redirect URLs.
3. **SQL Editor → New query**: paste and run each file in `supabase/migrations/` in order. They're safe to run again.
4. Put the Project URL and the publishable key in `.env.production` (both are public by design; row-level security restricts every row to its owner).
5. In the app: **Settings → Sync between devices**, sign in with the email link on each device.

Free Supabase projects pause after about a week without use. The app keeps working offline; resume the project in the Supabase dashboard to sync again.

## GitHub secrets

Repository **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Used for |
|---|---|
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Recording audio (Azure Speech, Free F0) |
| `SUPABASE_SERVICE_KEY` | Reading the "report bad audio" queue, and finding the owner's account for the translation helper |
| `AZURE_TRANSLATOR_KEY` | Better translation (Azure Translator, Free F0) |
| `SUPABASE_ACCESS_TOKEN` | Deploying the translation helper to Supabase |

Keys are never committed and never pasted into chats.

## Installing the app

- **Android (Chrome):** open the app, menu ⋮ → Install / Add to Home screen.
- **Windows (Chrome or Edge):** the install icon in the address bar.

## Development note

The `deps-snapshot` workflow stores a copy of `node_modules` on the `deps-cache` branch, for sandboxed coding agents that can't reach the npm registry. It can be ignored otherwise.
