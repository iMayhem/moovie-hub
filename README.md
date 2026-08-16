# Moovie Hub

All-in-One Media Stream Scraper with full web UI.

## Layout

- `server/server.js` — main hub server (Express + SSE scrape + WS + proxy)
- `server/deobfuscated/` — all stream scraper provider modules
- `server/public/` — web dashboard UI
- `server/analytics.js`, `server/watch-together.js` — helpers
- `server/config.json` — server config (port, tmdbApiKey, proxy)
- `server/providers.json` — per-provider enabled/priority/proxyMode (created on first run)

## Run

```bash
npm install
npm start          # node server/server.js
# or
pm2 start server/server.js --name moovie-hub
```

## API

- `GET /api/providers` — list all providers with enabled state
- `POST /api/providers/:id/toggle` — enable/disable a provider
- `GET /scrape?tmdbId=X&type=movie|tv&season=&episode=` — SSE scrape across all enabled providers
- `GET /scrape/source?id=PROVIDER&tmdbId=X&type=&season=&episode=` — scrape a single provider (SSE)
- `GET /api/search?q=TMDBID&type=movie|tv` — REST search fallback
- `GET /api/settings` / `PUT /api/settings` — config management

## Auth

Dashboard lock screen: `admin` / `peestream2026` (override via `ADMIN_USER` / `ADMIN_PASSWORD` env).