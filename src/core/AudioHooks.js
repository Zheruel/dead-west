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
const FIRE_HURT = { key: 'fire_whoosh', opts: { vol: 0.6 } };
const HAZARD_SFX = { lava: FIRE_HURT, vent: FIRE_HURT, fire: FIRE_HURT, cart: 'cart_rumble', chandelier: 'chandelier_crash' };

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
  // --- round 2 (AUDIO_SPEC_V2 s9). Owners that already play the same key directly are absorbed by the mix row's rate limit (first play wins).
  'boss:phase': (p) => {
    const id = p.id || (p.boss && p.boss.id);
    return { toro: 'bull_roar', engine: 'train_horn', scratch: 'devil_laugh' }[id] || { key: 'boss_hit', opts: { rate: 0.6 } };
  },
  'deal:signed': 'contract_sign',
  'deal:refused': 'shop_deny',
  'deal:paid': (p) => (p.pay && (p.pay.hearts || p.pay.container) ? 'heart_pay' : null),
  'gate:opened': 'hellgate_open',
  'pocket:left': { key: 'door_close', opts: { rate: 0.8 } },
  'curse:gained': 'curse_gain',
  'blessing:gained': 'blessing_gain',
  'player:revived': 'revive_ace',
  // CardSharp settles pushes with chip_place (payout == bet): only a real win / bust is a card sting
  'bet:result': (p) => (p.outcome === 'push' || p.payout === p.bet ? 'chip_place' : p.payout > p.bet ? 'card_win' : 'card_lose'),
  'potion:drunk': 'potion_gulp',
  'mini:spawned': 'mini_intro',
  'mini:defeated': { key: 'boss_die', opts: { vol: 0.6, rate: 1.25 } },
  'elite:spawned': 'elite_spawn',
  'supersecret:entered': 'hellgate_enter',
  'modifier:entered': (p) => ({ blood_moon: 'blood_moon_howl', lurch: 'lurch_creak' }[p.id] || null),
  'hazard:hurt': (p) => HAZARD_SFX[p.type] || null,
  // Not hooked on purpose, their owners already play the sound with better timing (a hook would double it):
  //   pocket:entered (HellGate.go plays hellgate_enter), secret:revealed (Room plays door_unlock), secret:hint (SecretVariants plays wall_knock),
  //   meta:unlocked / meta:achievement (AchievementToast plays item_get at display time), meta:rank (same toast; wants stamp_slam),
  //   synergy:activated (SynergyToast plays item_get@1.4; `synergy_chime` is ready for it). See docs/v2/INTEGRATION_REQUESTS.md.
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
