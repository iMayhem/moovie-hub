# Moovie Hub

All-in-One Media Stream Scraper with full web UI.

## Layout

- `server/server.js` — main hub server (Express + SSE scrape + WS + proxy)
- `deobfuscated/` — all stream scraper provider modules
- `server/public/` — web dashboard UI (admin, docs, embed player)
- `server/analytics.js`, `server/watch-together.js` — helpers
- `server/config.json` — server config (port, tmdbApiKey, proxy)
- `server/providers.json` — per-provider enabled/priority/proxyMode (created on first run, gitignored)

## Quick start

```bash
npm install
npm start          # node server/server.js
# or
pm2 start server/server.js --name moovie-hub
```

Open `http://localhost:3000` — the dashboard shows a login screen on first visit.

## Configuration

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `TMDB_API_KEY` | TMDB key (used by providers + `/api/tmdb/search` + subtitles) | `config.json` value |
| `ADMIN_USER` | Dashboard login username | `admin` |
| `ADMIN_PASSWORD` | Dashboard login password | random, printed in console at startup |
| `CF_PROXY_BASE` | External Cloudflare header proxy base URL (e.g. `https://proxy.example.com`) | unset → hub's own `/proxy` used |
| `PROXY_BASE` | External proxy base for providers that proxy streams | unset → relative `/proxy` used |
| `LEGACY_PROXY_DOMAIN` | Domain of a legacy wrapper proxy to unwrap in provider URLs | unset → no unwrapping |
| `VIDSUPER_PROXY_ORIGIN` | Origin used by Vidsuper provider for proxied stream URLs | unset → relative `/proxy` used |
| `SELF_DOMAINS` | Comma-separated list of your own domains (analytics treats them as direct traffic) | unset |

### config.json

- `port` — HTTP port
- `tmdbApiKey` — TMDB API key (falls back to `TMDB_API_KEY` env)
- `proxy` — optional upstream proxy: `{ enabled, type, host, port, username, password }`
- `globalTimeout` — per-request fetch timeout in ms
- `maxResultsPerProvider` — max stream results per provider

## API

- `GET /api/providers` — list all providers with enabled state
- `POST /api/providers/:id/toggle` — enable/disable a provider
- `GET /scrape?tmdbId=X&type=movie|tv&season=&episode=` — SSE scrape across all enabled providers
- `GET /scrape/source?id=PROVIDER&tmdbId=X&type=&season=&episode=` — scrape a single provider (SSE)
- `GET /api/search?q=TMDBID&type=movie|tv` — REST search fallback
- `GET /api/tmdb/search?q=QUERY` — server-side TMDB search (no client key needed)
- `GET /api/subtitles?tmdbId=X&type=movie|tv&season=&episode=` — OpenSubtitles captions
- `GET /proxy?u=BASE64URL&h=BASE64URL_JSON` — media proxy (HLS rewrite, range support)
- `GET /api/settings` / `PUT /api/settings` — config management

## Embed player

`/embed/?tmdbId={id}&type=movie|tv&season={s}&episode={e}` — landing page with code
templates + player view. Point `?player=` at your own player frontend (defaults to
the hub origin).

## Adding providers

Drop a `.js` file in `deobfuscated/` exporting:

```js
module.exports = {
  name: 'MyProvider',
  supportedTypes: ['movie', 'tv'],
  async getStreams(tmdbId, type, season, episode) {
    return [{ url: '...', type: 'hls'|'mp4'|'dash', quality: '1080', headers: { Referer: '...' } }];
  },
};
```

Restart the hub and toggle it on in the dashboard.

## Auth

Dashboard lock screen protects admin actions. Credentials come from
`ADMIN_USER` / `ADMIN_PASSWORD` env; if unset, a random password is generated and
printed to the console at startup.