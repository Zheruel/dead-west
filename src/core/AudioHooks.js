// Declarative event -> sfx table. To hook a new sound: add a row (string key, or fn(payload) returning a key / {key, opts} / null).
// Levels, polyphony and rate limits per key live in mix.js; `opts.vol` here is a multiplier on that mix. Music / ambience / footsteps: AudioDirector.js.
// High-frequency per-object sounds (shoot, hit, door state) are played directly by the owning system with Sfx.play().
import { bus } from './events.js';
import { Sfx } from './Audio.js';
import { installAudioDirector } from './AudioDirector.js';

const PICKUP_SFX = {
  heart_full: 'pickup_heart', heart_half: { key: 'pickup_heart', opts: { rate: 1.12 } }, heart_tin: { key: 'pickup_heart', opts: { rate: 1.3, vol: 0.9 } },
  coin: 'pickup_coin', coin_nickel: { key: 'pickup_coin', opts: { rate: 0.9, vol: 1.15 } },
  key: 'pickup_key', dynamite: 'pickup_dynamite',
};
const jit = (c) => (Math.random() - 0.5) * c;

export const EVENT_SFX = {
  'player:hurt': 'player_hurt',
  'player:died': 'player_die',
  'enemy:died': (p) => (p.boss ? null : { key: 'enemy_die', opts: { vol: p.cursed ? 1 : 0.9, detune: jit(300) } }),
  'boss:defeated': 'boss_die',
  'room:cleared': 'room_clear',
  'item:picked': 'item_get',
  'pickup:collected': (p) => PICKUP_SFX[p.type] || 'pickup_coin',
  'shop:bought': 'shop_buy',
  'pickup:denied': 'shop_deny',
  'boss:intro': 'boss_intro',
  'player:rolled': 'dodge_roll',
  'explosion': 'explosion',
  'spawn:telegraph': 'spawn',
};

export function installAudioHooks(game) {
  for (const [evt, spec] of Object.entries(EVENT_SFX)) {
    bus.on(evt, (payload) => {
      const r = typeof spec === 'function' ? spec(payload || {}) : spec;
      if (!r) return;
      if (typeof r === 'string') Sfx.play(r);
      else Sfx.play(r.key, r.opts);
    });
  }
  installAudioDirector(game || window.__game);
}
