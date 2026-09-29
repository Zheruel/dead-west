// On-demand audio loader for music + ambience (SFX are loaded up front by the Phaser loader). fetch() -> decodeAudioData -> Phaser audio cache,
// so `Sfx/Music` treat lazily loaded tracks exactly like preloaded ones. Deduplicated, progress events on the bus:
//   'audio:loading' {key}  'audio:loaded' {key, bytes}  'audio:failed' {key}
// ensure(keys) -> Promise<boolean> (foreground, parallel); prefetch(keys) -> low-priority serial queue that yields to foreground loads.
import { Assets } from './Assets.js';
import { bus } from './events.js';

const inflight = new Map(); // key -> Promise<boolean>
const failedAt = new Map();
let game = null;
let fg = 0; // foreground loads in flight (prefetch waits for 0)
let queue = Promise.resolve();
export const AUDIO_STATS = { bytes: 0, loaded: [] };

async function fetchOne(key) {
  const meta = Assets.audioMeta(key);
  if (!meta.file || !game || !game.sound || !game.sound.context) return false; // no WebAudio -> lazy tracks unavailable
  try {
    const url = Assets._url(meta.file, 'audio');
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const buf = await res.arrayBuffer();
    const decoded = await game.sound.context.decodeAudioData(buf);
    game.cache.audio.add(key, decoded);
    Assets.realAudio.add(key);
    AUDIO_STATS.bytes += buf.byteLength;
    AUDIO_STATS.loaded.push(key);
    bus.emit('audio:loaded', { key, bytes: buf.byteLength });
    return true;
  } catch (e) {
    failedAt.set(key, performance.now());
    console.warn('[AudioLoader] failed', key, e && e.message);
    bus.emit('audio:failed', { key });
    return false;
  }
}

export const AudioLoader = {
  init(g) { game = g; },
  has(key) { return Assets.hasAudio(key); },
  /** True if this key exists in the manifest but is not decoded yet. */
  pending(key) { return !!Assets.manifest.audio[key] && !Assets.hasAudio(key); },
  ensure(keys, { prefetch = false } = {}) {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    return Promise.all(list.map((key) => {
      if (Assets.hasAudio(key)) return true;
      if (!Assets.manifest.audio[key]) return false;
      if (inflight.has(key)) return inflight.get(key);
      const t = failedAt.get(key);
      if (t && performance.now() - t < 8000) return false; // don't hammer a missing file
      bus.emit('audio:loading', { key });
      if (!prefetch) fg++;
      const p = fetchOne(key).finally(() => { inflight.delete(key); if (!prefetch) fg--; });
      inflight.set(key, p);
      return p;
    })).then((r) => r.every(Boolean));
  },
  /** Background load, one file at a time, only while no foreground load is running. */
  prefetch(keys) {
    const list = (Array.isArray(keys) ? keys : [keys]).filter((k) => k && this.pending(k));
    for (const key of list) {
      queue = queue.then(async () => {
        while (fg > 0) await new Promise((r) => setTimeout(r, 250));
        if (Assets.hasAudio(key)) return;
        await this.ensure(key, { prefetch: true });
      }).catch(() => {});
    }
    return queue;
  },
};
export default AudioLoader;
