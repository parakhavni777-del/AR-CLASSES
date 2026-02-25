# Go Live Guide (Static + Supabase)

This project is a static website backed by Supabase, so deployment is straightforward.

## Option 1: Vercel (Fastest via CLI)

1. Open terminal in this folder.
2. Run:

```bash
npm i -g vercel
vercel login
vercel --prod
```

3. When prompted:
- Framework preset: `Other`
- Build command: leave empty
- Output directory: `.`

Your live URL is shown at the end (for example `https://your-project.vercel.app`).

## Option 2: Netlify

1. Push this folder to a GitHub repo (or zip and drag-drop in Netlify UI).
2. In Netlify, create a new site from that repo.
3. Build settings:
- Build command: leave empty
- Publish directory: `.`

`netlify.toml` is already included for headers/caching.

## Required Supabase Checks Before/After Deploy

1. Run SQL from `supabase_schema_updates.sql`.
2. Create storage bucket `notes-files`.
3. Ensure RLS policies and table grants allow your anon key access.
4. In Supabase dashboard, add your deployed domain to:
- Auth URL allowlist / redirect URLs
- (If used) any storage/CORS rules for public browser access

## Post-Deploy Validation

1. Open `index.html` route on live domain.
2. Test Admin login.
3. Register a test student/faculty and approve from admin.
4. Upload/download a note.
5. Verify attendance + fee updates + parent login.
