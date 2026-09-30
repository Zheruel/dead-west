import { registerItem } from '../registry.js';
import { DEPTH } from '../../config.js';
import { Assets } from '../../core/Assets.js';

// On every wave the toughest living non-boss foe (highest maxHp, ties nearest) is marked for 8 s: it takes +50% damage from every source
// (Enemy.takeHit `mark` status, stats.markBonus). A marked kill pays a bounty: 1 nickel + 15% half heart. Each extra copy marks one more foe
// per wave (stats.markCount). The mark is drawn as a red crosshair (`fx_mark`, code-drawn fallback) over the head: a small pooled image set.
// Not the Bounty Hunter's WANTED controller (`enemy.marked`, familiars/WantedMark.js): the two stack.
const MARK_T = 8, HEART_CHANCE = 0.15, MAX_MARKS = 5;
const tmp = { x: 0, y: 0 };

const eligible = (e) => e && e.alive && !e.isBoss && !e.noClear && !e.status.mark && e.sprite;

/** Best unmarked candidate of `list` (highest maxHp, ties nearest to the player), or null. */
function toughest(list, player) {
  let best = null, bd = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!eligible(e)) continue;
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (!best || e.maxHp > best.maxHp || (e.maxHp === best.maxHp && d < bd)) { best = e; bd = d; }
  }
  return best;
}

function pickMarks(scene, player, wave, n, state) {
  for (let k = 0; k < n; k++) {
    const best = (wave && toughest(wave, player)) || toughest(scene.enemies, player);
    if (!best) return;
    best.applyStatus('mark', { t: MARK_T });
    if (state.marks.length < MAX_MARKS) state.marks.push(best);
  }
}

function marker(scene, state, i) {
  let im = state.imgs[i];
  if (im && im.scene) return im;
  if (Assets.has('fx_items')) im = Assets.makeCell(scene, 0, 0, 'fx_items', 'fx_mark', 0.5).setScale(0.5);
  else im = scene.add.image(0, 0, 'ring').setTint(0xd63a2a).setScale(0.5); // no art: a red ring
  im.setDepth(DEPTH.overlay - 9).setAlpha(0.95).setVisible(false);
  im.__noSnap = true;
  state.imgs[i] = im;
  return im;
}

registerItem({
  id: 'wanted_poster', name: 'Wanted Poster', desc: 'Marks the toughest foe: +50% damage taken, pays a bounty', type: 'passive', pool: ['treasure', 'shop'], weight: 0.8,
  icon: { sheet: 'items2_b', name: 'wanted_poster' },
  tags: ['gold', 'crit'], tier: 2,
  lore: 'Dead or dead.',
  state: () => ({ marks: [], imgs: [] }),
  apply(player, { stats }) { stats.markCount += 1; },
  hooks: {
    wave(player, ctx, { scene, stats, state }) {
      pickMarks(scene, player, ctx.room && ctx.room.waveEnemies, Math.max(1, stats.markCount), state);
    },
    kill(player, ctx, { scene }) {
      if (!ctx.st || !ctx.st.mark || !scene.room) return;
      const e = ctx.enemy;
      scene.room.dropPickup('coin_nickel', e.x, e.y + 6, { pop: true });
      if (!(scene.mut && scene.mut.noHearts) && player.crng.chance(HEART_CHANCE)) scene.room.dropPickup('heart_half', e.x + 24, e.y + 8, { pop: true });
      scene.fx.text(e.x, e.y - 60, 'BOUNTY', { color: '#e8c84a', size: 20 });
    },
    update(player, ctx, { scene, state }) {
      const marks = state.marks;
      for (let i = marks.length - 1; i >= 0; i--) {
        const e = marks[i];
        if (!e.alive || !e.sprite || !e.status.mark) { marks.splice(i, 1); continue; }
      }
      for (let i = 0; i < state.imgs.length || i < marks.length; i++) {
        if (i >= marks.length) { const im = state.imgs[i]; if (im && im.scene && im.visible) im.setVisible(false); continue; }
        const e = marks[i], im = marker(scene, state, i);
        e.sprite.getTopCenter(tmp);
        const pulse = 1 + 0.08 * Math.sin(scene.time.now * 0.012);
        im.setVisible(e.sprite.alpha > 0.4).setPosition(tmp.x, tmp.y - 22).setScale(0.5 * pulse);
      }
    },
  },
});
