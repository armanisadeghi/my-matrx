# CLAUDE.md — My Matrx

Simple Next.js app for serving dynamic HTML pages. Deployed on Vercel.

---

## Global Overrides

This project differs from the global engineering standards:
- **JavaScript** (not TypeScript) — uses `jsconfig.json`
- **Pages Router** (not App Router)
- **No Tailwind CSS**
- **No Redux or complex state management**

---

## Project Structure

```
pages/
  index.js            → Landing page
  admin.js            → Admin interface
  api/                → API routes (page creation, DB operations)
  c/                  → Dynamic content routes
  p/                  → Dynamic content routes
  utilities/          → Utility pages
public/               → Static HTML files (games/, iopbm/, samples/)
lib/                  → Supabase client and utilities
database/             → Schema and migration files
scripts/              → CLI tools for page management
```

---

## URL Rewriting

Clean URLs via `next.config.js` rewrites:
- `/games/:path` → `/games/:path.html`
- `/iopbm/:path` → `/iopbm/:path.html`
- `/samples/:path` → `/samples/:path.html`

---

## Supabase Integration

- HTML page content stored in Supabase database
- SEO fields: `meta_title`, `meta_description`, `meta_keywords`, `og_image`, `canonical_url`
- API endpoints handle CRUD operations for pages

---

## Integration

Pages from this site are embedded via iframe in the main AI Matrx admin app. See `MAIN_APP_INTEGRATION_INSTRUCTIONS.md` for the full integration guide.

---

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `node -e "..."` | Generate UUID for new pages (`pnpm generate-uuid`) |
| `pnpm env:pull` | Pull env from Doppler |
