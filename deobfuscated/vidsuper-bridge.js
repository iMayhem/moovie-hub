const DEFAULT_TIMEOUT = 12000;

function getVidsuperBase() {
  const base = process.env.VIDSUPER_BASE || process.env.VIDSUPER_ORIGIN || '';
  return base.replace(/\/+$/, '');
}

function inferType(type) {
  if (type === 'hls') return 'm3u8';
  if (type === 'dash') return 'mpd';
  return type || 'mp4';
}

function createVidsuperProvider(sourceId, displayName, rank) {
  return {
    name: displayName,
    supportedTypes: ['movie', 'tv'],
    rank,
    async getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
      const base = getVidsuperBase();
      if (!base) {
        throw new Error('VIDSUPER_BASE is not configured');
      }

      const params = new URLSearchParams({
        id: String(tmdbId),
        type: mediaType === 'show' ? 'tv' : mediaType,
        server: sourceId,
      });
      if (season) params.set('season', String(season));
      if (episode) params.set('episode', String(episode));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(process.env.VIDSUPER_TIMEOUT || DEFAULT_TIMEOUT));
      try {
        const res = await fetch(`${base}/api/sources?${params}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Vidsuper ${sourceId} failed (${res.status})`);
        const data = await res.json();
        const sources = Array.isArray(data.sources) ? data.sources : [];
        return sources
          .filter((source) => source && source.file)
          .map((source) => ({
            name: data.provider || displayName,
            title: data.provider || displayName,
            url: source.file,
            quality: source.label || 'Auto',
            type: inferType(source.type),
            headers: {},
          }));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

module.exports = { createVidsuperProvider };
