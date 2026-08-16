'use strict';
/**
 * Arceus — OMSS scraper adapter for banalokya.onrender.com (CinePro).
 * Providers: ModiPlay, VaPlayer, VidRift, XPass.
 * Endpoints:
 *   movie: /v1/movies/{tmdbId}
 *   tv:    /v1/tv/{tmdbId}/seasons/{s}/episodes/{e}
 * The service returns already-proxied HLS URLs (its own /v1/proxy), which work
 * in any browser directly, so we pass them through untouched.
 */
const ARCEUS_API = 'https://banalokya.onrender.com';
const TIMEOUT_MS = 25000;
const MAX_SOURCES = 15;

async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
        });
        if (!res.ok) throw new Error(`Arceus HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

function mapSource(src, expiresAt) {
    if (!src || typeof src.url !== 'string') return null;
    const providerName = (src.provider && src.provider.name) || 'Arceus';
    const quality = src.quality || 'Auto';
    return {
        name: `[${providerName}]`,
        title: quality,
        url: src.url,
        quality: quality,
        type: src.type === 'mp4' ? 'mp4' : 'm3u8',
        provider: 'arceus',
        headers: {},
        _expiresAt: expiresAt || null,
    };
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const id = String(tmdbId || '');
    if (!id) return [];
    const type = mediaType === 'tv' || mediaType === 'anime' ? 'tv' : 'movie';
    let url;
    if (type === 'tv') {
        const s = season != null ? season : 1;
        const e = episode != null ? episode : 1;
        url = `${ARCEUS_API}/v1/tv/${encodeURIComponent(id)}/seasons/${encodeURIComponent(String(s))}/episodes/${encodeURIComponent(String(e))}`;
    } else {
        url = `${ARCEUS_API}/v1/movies/${encodeURIComponent(id)}`;
    }

    console.log(`[Arceus] fetching ${type} ${id} (${url})`);
    let json;
    try {
        json = await fetchJson(url);
    } catch (e) {
        console.log(`[Arceus] request failed: ${e.message}`);
        return [];
    }

    const sources = Array.isArray(json && json.sources) ? json.sources : [];
    if (!sources.length) {
        console.log(`[Arceus] no sources for ${type} ${id}`);
        return [];
    }

    const expiresAt = json.expiresAt || null;
    const out = [];
    for (const src of sources.slice(0, MAX_SOURCES)) {
        const mapped = mapSource(src, expiresAt);
        if (mapped) out.push(mapped);
    }
    if (out.length) out[0]._cacheExpiresAt = expiresAt;
    console.log(`[Arceus] ${out.length} stream(s) for ${type} ${id}`);
    return out;
}

module.exports = {
    name: 'Arceus',
    supportedTypes: ['movie', 'tv'],
    getStreams,
};