const { activeSources } = require('./vidsuper-runtime.cjs');

const DEFAULT_ORIGIN = (process.env.VIDSUPER_PROXY_ORIGIN || '').replace(/\/+$/, '');

function inlineProxy(origin, url, headers) {
  if (!url) return url;
  const encodedUrl = Buffer.from(String(url)).toString('base64url');
  const headerValue = headers && Object.keys(headers).length
    ? `&h=${Buffer.from(JSON.stringify(headers)).toString('base64url')}`
    : '';
  return `${origin}/proxy?u=${encodedUrl}${headerValue}`;
}

function normalizeType(type, url) {
  const value = String(type || '').toLowerCase();
  const sourceUrl = String(url || '').toLowerCase();
  if (value === 'hls' || value === 'm3u8' || sourceUrl.includes('.m3u8')) return 'm3u8';
  if (value === 'dash' || value === 'mpd' || sourceUrl.includes('.mpd')) return 'mpd';
  if (value === 'native') return 'mp4';
  return value || (sourceUrl.includes('.mp4') ? 'mp4' : 'mp4');
}

function subtitleTracks(subtitles) {
  return (Array.isArray(subtitles) ? subtitles : [])
    .filter((subtitle) => subtitle && subtitle.url)
    .map((subtitle) => ({
      url: subtitle.url,
      display: subtitle.display || subtitle.language || 'Subtitle',
      language: subtitle.language || '',
      source: subtitle.source || 'Subtitle',
    }));
}

function createVidsuperProvider(source) {
  if (!source || typeof source.fetch !== 'function') {
    throw new Error('Vidsuper source is unavailable');
  }
  return {
    name: source.name,
    supportedTypes: ['movie', 'tv'],
    async getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
      const origin = DEFAULT_ORIGIN;
      const ctx = {
        tmdbId: Number(tmdbId),
        season: Number(season) || 0,
        episode: Number(episode) || 0,
        origin,
        proxyStream: (url, referer) => inlineProxy(origin, url, referer ? { Referer: referer } : {}),
        proxySub: (url, referer) => inlineProxy(origin, url, referer ? { Referer: referer } : {}),
      };
      if (!Number.isFinite(ctx.tmdbId)) return [];
      const result = await source.fetch(ctx);
      if (!result || !Array.isArray(result.streams)) return [];
      const captions = subtitleTracks(result.subtitles);
      return result.streams
        .filter((stream) => stream && stream.file)
        .map((stream) => ({
          url: stream.file,
          type: normalizeType(stream.type, stream.file),
          name: stream.name || stream.provider || source.name,
          title: stream.title || stream.provider || source.name,
          quality: stream.label || 'auto',
          captions,
        }));
    },
  };
}

function getSource(id) {
  return activeSources().find((source) => source.id === id);
}

module.exports = { createVidsuperProvider, getSource };
