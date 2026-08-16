'use strict';

// VidEasy / VidKing Wings provider. The Wings response is XOR-decrypted with
// the same stream cipher used by the client, then normalized to hub streams.
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const WINGS_BASE = 'https://api.speedracelight.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: '*/*',
  Origin: 'https://www.vidking.net',
  Referer: 'https://www.vidking.net/',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};
const SERVERS = {
  Hydrogen: 'cdn/sources-with-title', Titanium: 'tejo/sources-with-title',
  Oxygen: 'neon2/sources-with-title', Lithium: 'downloader2/sources-with-title',
  Krypton: 'ym/sources-with-title', Carbon: 'mb-flix/sources-with-title',
  Aluminium: 'lamovie/sources-with-title', Nitrogen: 'm4uhd/sources-with-title',
  Neon: 'superflix/sources-with-title', Helium: '1movies/sources-with-title',
};
const JL = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174];
const TF0 = 0x67452301, MS = 0x9e3779b9;
const rot = (x, n) => { x >>>= 0; n &= 31; return n ? ((x << n) | (x >>> (32 - n))) >>> 0 : x; };
function ui(x) { x >>>= 0; x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function hashSeed(str) { let h = TF0 >>> 0; for (let i = 0; i < str.length; i++) h = rot((h ^ Math.imul(str.charCodeAt(i), JL[i & 15])) >>> 0, 5); return ui(h); }
function hashText(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x1000193) >>> 0; return ui(h); }
function keySchedule(seed, tmdbId) {
  const S = new Array(61);
  let acc = ui(hashText(seed) ^ ui((tmdbId >>> 0) ^ MS));
  for (let i = 0; i < 8; i++) { const idx = acc % 61; acc = rot((acc + MS) >>> 0, 7 + (i & 7)); S[idx] = (acc ^ ui(acc)) >>> 0; acc = ui((acc + idx) >>> 0); }
  return { S, acc: ui(acc ^ 0xa5a5a5a5) >>> 0 };
}
function nextWord(state, counter) {
  const idx = state.acc % 61;
  const slot = (state.S[idx] || 0) >>> 0;
  const mix = Math.imul(MS, counter + 1) >>> 0;
  const has = idx in state.S ? -1 : 0;
  let v = (((state.acc ^ slot ^ mix) >>> 0) | (state.acc & slot & has)) >>> 0;
  v = (rot((v + state.acc) >>> 0, idx & 31) ^ rot(state.acc, Math.imul(idx, 7) & 31)) >>> 0;
  state.acc = ui((v + MS) >>> 0); state.S[idx] = state.acc; return state.acc;
}
function keystream(seed, tmdbId, length) {
  const state = keySchedule(seed, tmdbId); const out = Buffer.alloc(length); let counter = 0;
  for (let i = 0; i < length;) { const w = nextWord(state, counter++); out[i++] = w & 255; if (i < length) out[i++] = w >>> 8; if (i < length) out[i++] = w >>> 16; if (i < length) out[i++] = w >>> 24; }
  return out;
}
function decrypt(body, seed, tmdbId) {
  const b64 = body.replace(/-/g, '+').replace(/_/g, '/'); const data = Buffer.from(b64, 'base64'); const ks = keystream(seed, tmdbId, data.length);
  for (let i = 0; i < data.length; i++) data[i] ^= ks[i];
  if (data.subarray(0, 4).toString('ascii') !== 'mvm1') throw new Error('bad seed or encrypted payload');
  return data.subarray(4).toString('utf8');
}
async function mediaDetails(tmdbId, type, season, episode) {
  const kind = type === 'tv' ? 'tv' : 'movie'; const id = String(tmdbId).replace(/\D/g, '');
  const res = await fetch(`${TMDB_BASE}/${kind}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`); const data = await res.json();
  let duration = kind === 'tv' ? '45 min' : '90 min';
  if (kind === 'movie' && data.runtime) duration = `${data.runtime} min`;
  if (kind === 'tv' && season != null && episode != null) {
    const ep = await fetch(`${TMDB_BASE}/tv/${id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`).then(r => r.ok ? r.json() : null);
    if (ep?.runtime) duration = `${ep.runtime} min`; else if (data.episode_run_time?.[0]) duration = `${data.episode_run_time[0]} min`;
  }
  return { title: kind === 'tv' ? data.name : data.title, year: ((kind === 'tv' ? data.first_air_date : data.release_date) || '').slice(0, 4), imdbId: data.external_ids?.imdb_id || '', mediaType: kind, duration };
}
function langCode(lang) { const map = { english:'en', spanish:'es', french:'fr', german:'de', italian:'it', portuguese:'pt', japanese:'ja', korean:'ko', tamil:'ta', telugu:'te', malayalam:'ml', kannada:'kn', hindi:'hi', arabic:'ar' }; return map[String(lang || '').toLowerCase().trim()] || 'en'; }
function format(jsonText, server, meta, season, episode) {
  const data = JSON.parse(jsonText); const headers = { 'User-Agent': USER_AGENT, Referer: 'https://www.vidking.net/', Origin: 'https://www.vidking.net' };
  const subtitles = (data.subtitles || []).filter(s => s.url).map(s => ({ url: s.url, language: langCode(s.language || s.lang), name: s.language || s.lang || 'English', headers }));
  return (data.sources || []).filter(s => s.url).map(src => {
    const quality = server === 'Oxygen' ? 'Auto' : String(src.quality || '1080p').replace(/\s*server\s*2\s*$/i, '').trim();
    return { name: `VidEasy | ${quality}`, title: `${meta.title}${meta.mediaType === 'tv' ? ` S${season}E${episode}` : ''} (${meta.year}) · ${quality} · ${server}`, url: src.url, type: src.url.includes('.m3u8') ? 'm3u8' : 'mp4', quality, headers, subtitles, provider: 'videasy', _is4k: /2160|4k/i.test(quality), _serverName: server };
  });
}
async function queryServer(name, pathName, type, tmdbId, meta, seed, season, episode) {
  const params = new URLSearchParams({ title: meta.title || '', mediaType: type, year: String(meta.year || ''), episodeId: String(episode || 1), seasonId: String(season || 1), tmdbId: String(tmdbId), imdbId: meta.imdbId || '', enc: '2', seed });
  const url = `${WINGS_BASE}/${pathName}?${params}`; console.log(`[VidEasy] querying ${name}`);
  try { const res = await fetch(url, { headers: HEADERS }); if (!res.ok) throw new Error(`HTTP ${res.status}`); const body = await res.text(); if (!body.trim()) throw new Error('empty response'); const streams = format(decrypt(body, seed, Number(tmdbId)), name, meta, season, episode); console.log(`[VidEasy] ${name}: ${streams.length} stream(s)`); return streams; }
  catch (e) { console.warn(`[VidEasy] ${name}: ${e.message}`); return []; }
}
async function getStreams(tmdbId, mediaType, season = null, episode = null) {
  console.log(`[VidEasy] starting ${tmdbId} ${mediaType}`);
  try {
    const meta = await mediaDetails(tmdbId, mediaType, season, episode);
    const seedRes = await fetch(`${WINGS_BASE}/seed?mediaId=${encodeURIComponent(tmdbId)}`, { headers: HEADERS });
    if (!seedRes.ok) throw new Error(`seed HTTP ${seedRes.status}`); const seed = (await seedRes.json()).seed; if (!seed) throw new Error('no seed returned');
    const lists = await Promise.all(Object.entries(SERVERS).map(([name, pathName]) => queryServer(name, pathName, mediaType, tmdbId, meta, seed, season, episode)));
    const seen = new Set(); const all = lists.flat().filter(s => !seen.has(s.url) && seen.add(s.url));
    all.sort((a, b) => Number(b._is4k) - Number(a._is4k)); return all;
  } catch (e) { console.error(`[VidEasy] failed: ${e.message}`); return []; }
}
module.exports = { name: 'VidEasy', supportedTypes: ['movie', 'tv'], getStreams };
