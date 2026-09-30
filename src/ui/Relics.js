// Collected passive relics strip (bottom-left, over the wall band): unique icons with an xN badge for stacks, a pop + glint when a new one is
// picked up, a gold underline under relics that take part in an active synergy (glint when one activates), and a hover tooltip driven by manual
// pointer hit-testing (no interactive objects, so the HUD never steals game clicks).
// Tooltip: name, tier + tag chips, lore, description, synergy lines (ACTIVE / partner hint / ??? when undiscovered / tag progress).
// Also exports BuildPanel: the Pause BUILD tab body (relics with tags, active synergies, tag progress bars, curse chips), mounted by PauseScene.
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import Save from '../core/Save.js';
import { getItem } from '../items/registry.js';
import { tagColor, tagLabel, tagCounts, ownedIds } from '../items/tags.js';
import { SYNERGIES, SYN_BY_ID, SYN_KIND_COLOR, synergiesFor } from '../items/synergies.js';
import { CURSES } from '../systems/Boons.js';
import { FONT_TITLE, FONT_BODY, CSS } from '../config.js';

const X0 = 34, Y0 = 898, STEP = 40, ROW_H = 38, PER_ROW = 10, MAX = 20, SC = 0.38;
const ROMAN = ['', 'I', 'II', 'III'];
const TAG_MAX_LINES = 3;

/** Highest count any tag synergy asks of `tag` (bar target), default 3. */
function tagTarget(tag) {
  let n = 0;
  for (const s of SYNERGIES) if (s.req.tags && s.req.tags[tag]) n = Math.max(n, s.req.tags[tag]);
  return n || 3;
}
/** Does synergy `s` involve item `id` (named pair member, or a tag the item carries)? */
function involves(s, id, def) {
  if (s.req.items && s.req.items.includes(id)) return true;
  const tags = (def && def.tags) || [];
  return !!((s.req.tags && Object.keys(s.req.tags).some((t) => tags.includes(t))) || (s.req.anyTags && s.req.anyTags.of.some((t) => tags.includes(t))));
}

export default class Relics {
  constructor(hud) {
    this.hud = hud;
    this.objs = [];
    this.cells = [];
    this.sig = null;
    this.synSig = '';
    this.glint = null;
    this.prevIds = new Set();
    this.tip = hud.add.container(0, 0).setDepth(200).setVisible(false);
    this.tipBg = hud.add.graphics();
    this.tipName = hud.add.text(0, 0, '', { fontFamily: FONT_TITLE, fontSize: '22px', color: CSS.amber, stroke: '#120c0a', strokeThickness: 4 });
    this.tipMeta = hud.add.text(0, 0, '', { fontFamily: FONT_TITLE, fontSize: '15px', color: CSS.sand });
    this.tipChips = [];
    for (let i = 0; i < 4; i++) this.tipChips.push(hud.add.text(0, 0, '', { fontFamily: FONT_TITLE, fontSize: '15px', color: '#fff' }));
    this.tipLore = hud.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '16px', color: CSS.sand, fontStyle: 'italic', wordWrap: { width: 360 } });
    this.tipDesc = hud.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '18px', color: CSS.bone, wordWrap: { width: 360 } });
    this.tipSyn = [];
    for (let i = 0; i < 1 + TAG_MAX_LINES + 2; i++) this.tipSyn.push(hud.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '16px', color: '#8fc23f', wordWrap: { width: 360 } }));
    this.tip.add([this.tipBg, this.tipName, this.tipMeta, ...this.tipChips, this.tipLore, this.tipDesc, ...this.tipSyn]);
    this.hover = null;
    bus.scoped(hud, 'synergy:activated', (p) => { this.synSig = null; this.glint = p && p.def ? p.def : null; });
    bus.scoped(hud, 'synergy:lost', () => { this.synSig = null; });
  }

  rebuild(uniq, counts, player) {
    const h = this.hud;
    for (const o of this.objs) o.destroy();
    this.objs = []; this.cells = [];
    const shown = uniq.slice(0, MAX);
    const active = player && player.synergies ? [...player.synergies].map((id) => SYN_BY_ID[id]).filter(Boolean) : [];
    const glint = this.glint; this.glint = null;
    shown.forEach((id, i) => {
      const def = getItem(id);
      const ic = (def && def.icon) || { sheet: 'items_passive_a', name: id };
      const x = X0 + (i % PER_ROW) * STEP + STEP / 2 - 6, y = Y0 + Math.floor(i / PER_ROW) * ROW_H;
      const back = h.add.circle(x, y, 18, 0x120c0a, 0.62).setStrokeStyle(2, 0x6b4423, 0.9).setDepth(9);
      const im = Assets.makeCell(h, x, y, ic.sheet, ic.name, 0.5).setScale(SC).setDepth(10);
      this.objs.push(back, im);
      const n = counts.get(id);
      if (n > 1) this.objs.push(h.add.text(x + 15, y + 10, `x${n}`, { fontFamily: FONT_BODY, fontSize: '13px', color: CSS.bone, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(11));
      if (active.some((s) => involves(s, id, def))) {
        const ul = h.add.rectangle(x, y + 21, 26, 3, 0xf0d060, 0.95).setDepth(11);
        this.objs.push(ul);
        if (glint && involves(glint, id, def)) {
          ul.setFillStyle(0xffffff, 1).setScale(1.6, 2.2);
          h.tweens.add({ targets: ul, scaleX: 1, scaleY: 1, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ul.setFillStyle(0xf0d060, 0.95) });
          h.tweens.add({ targets: back, scale: { from: 1.5, to: 1 }, duration: 500, ease: 'Back.easeOut' });
        }
      }
      this.cells.push({ x, y, id, def, n });
      if (!this.prevIds.has(id) && this.sig !== null) {
        im.setScale(0.9).setTintFill(0xffffff);
        h.time.delayedCall(120, () => im.clearTint());
        h.tweens.add({ targets: im, scale: SC, duration: 460, ease: 'Elastic.easeOut' });
        h.tweens.add({ targets: back, scale: { from: 1.7, to: 1 }, duration: 360, ease: 'Back.easeOut' });
      }
    });
    if (uniq.length > MAX) this.objs.push(h.add.text(X0 + PER_ROW * STEP, Y0 + ROW_H, `+${uniq.length - MAX}`, { fontFamily: FONT_BODY, fontSize: '16px', color: CSS.sand, stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0, 0.5).setDepth(10));
    this.prevIds = new Set(uniq);
  }

  /** Fill and lay out the tooltip for one cell. */
  fillTip(c, player) {
    const def = c.def;
    this.tipName.setText(def ? `${def.name}${c.n > 1 ? `  x${c.n}` : ''}` : c.id).setPosition(14, 8);
    let y = this.tipName.height + 10;
    const tags = (def && def.tags) || [];
    this.tipMeta.setText(def ? `TIER ${ROMAN[def.tier] || ''}` : '').setPosition(14, y + 2);
    let x = 14 + (def ? this.tipMeta.width + 12 : 0);
    for (let i = 0; i < this.tipChips.length; i++) {
      const t = this.tipChips[i];
      if (tags[i]) { t.setText(tagLabel(tags[i])).setColor(tagColor(tags[i])).setPosition(x, y + 2); x += t.width + 10; } else t.setText('');
    }
    y += this.tipMeta.height + 6;
    if (def && def.lore) { this.tipLore.setText(def.lore).setPosition(14, y); y += this.tipLore.height + 4; } else this.tipLore.setText('');
    this.tipDesc.setText(def ? def.desc || '' : '').setPosition(14, y);
    y += this.tipDesc.height + 6;
    // synergy section
    let li = 0;
    const line = (txt, col) => { if (li >= this.tipSyn.length) return; const t = this.tipSyn[li++]; t.setText(txt).setColor(col).setPosition(14, y); y += t.height + 2; };
    if (def && player) {
      const owned = new Set(ownedIds(player)), counts = tagCounts(player), seen = (Save.get().codex.synergies) || {};
      let tagLines = 0;
      for (const s of synergiesFor(c.id)) {
        if (player.synergies && player.synergies.has(s.id)) { line(`ACTIVE: ${s.name}`, SYN_KIND_COLOR[s.kind] || '#8fc23f'); continue; }
        if (s.req.items) {
          const partner = s.req.items.find((id) => id !== c.id && !owned.has(id));
          if (!partner) continue;
          const pd = getItem(partner);
          line(seen[s.id] && pd ? `+ ${pd.name} = ${s.name}` : '??? synergy', seen[s.id] ? '#c8b070' : '#8a7a5a');
        } else if (s.req.tags && tagLines < TAG_MAX_LINES) {
          const t = Object.keys(s.req.tags).find((k) => tags.includes(k));
          if (!t) continue;
          tagLines++;
          line(`${tagLabel(t)} ${counts[t] || 0}/${s.req.tags[t]}`, tagColor(t));
        }
      }
    }
    for (; li < this.tipSyn.length; li++) this.tipSyn[li].setText('');
    let w = Math.max(this.tipName.width, this.tipDesc.width, x - 14, this.tipLore.width);
    for (const t of this.tipSyn) w = Math.max(w, t.width);
    const hh = y + 6;
    w += 28;
    this.tipBg.clear().fillStyle(0x0d0806, 0.95).fillRoundedRect(0, 0, w, hh, 8).lineStyle(3, 0x8a4b1f, 1).strokeRoundedRect(0, 0, w, hh, 8);
    this.tipW = w; this.tipH = hh;
  }

  update(g) {
    const ids = g.player.items;
    const sig = ids.join(',');
    if (sig !== this.sig || this.synSig === null) {
      const counts = new Map();
      for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
      this.rebuild([...counts.keys()], counts, g.player);
      this.sig = sig; this.synSig = '';
      this.hover = null;
    }
    // hover tooltip
    const p = this.hud.input.activePointer;
    let hit = null;
    if (this.cells.length) for (const c of this.cells) if (Math.abs(p.x - c.x) <= 19 && Math.abs(p.y - c.y) <= 19) { hit = c; break; }
    if (!hit) { this.tip.setVisible(false); this.hover = null; return; }
    if (hit !== this.hover) { this.hover = hit; this.fillTip(hit, g.player); }
    this.tip.setPosition(Math.min(1440 - this.tipW - 8, hit.x - 14), hit.y - 24 - this.tipH).setVisible(true);
  }
  destroy() { for (const o of this.objs) o.destroy(); this.tip.destroy(); }
}

/**
 * BUILD tab body for the pause menu. `new BuildPanel(scene, x, y, w)` then `refresh(player)` when the tab opens; `container` can be added to
 * a parent container / depth-set by the caller. Objects are created per refresh (a menu action, never per frame).
 */
export class BuildPanel {
  constructor(scene, x = 0, y = 0, w = 1000) {
    this.scene = scene;
    this.w = w;
    this.container = scene.add.container(x, y);
    this.kids = [];
  }

  clear() { for (const o of this.kids) o.destroy(); this.kids.length = 0; }
  add(o) { this.container.add(o); this.kids.push(o); return o; }
  text(x, y, s, size, color, font = FONT_BODY) { return this.add(this.scene.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color, stroke: '#120c0a', strokeThickness: 3 })); }

  refresh(player) {
    this.clear();
    const s = this.scene, colW = this.w / 2;
    // relics
    this.text(0, 0, 'RELICS', 24, CSS.amber, FONT_TITLE);
    const ids = ownedIds(player);
    const owned = new Map();
    for (const id of player.items) owned.set(id, (owned.get(id) || 0) + 1);
    let y = 34;
    ids.slice(0, 14).forEach((id) => {
      const def = getItem(id);
      const ic = (def && def.icon) || { sheet: 'items_passive_a', name: id };
      this.add(Assets.makeCell(s, 16, y + 14, ic.sheet, ic.name, 0.5).setScale(0.36));
      const n = owned.get(id) > 1 ? ` x${owned.get(id)}` : '';
      const nm = this.text(40, y, `${def ? def.name : id}${n}`, 17, CSS.bone);
      let x = 40 + nm.width + 10;
      for (const t of ((def && def.tags) || []).slice(0, 4)) { const c = this.text(x, y + 3, tagLabel(t), 13, tagColor(t), FONT_TITLE); x += c.width + 8; }
      y += 28;
    });
    if (!ids.length) this.text(0, 34, 'Nothing yet.', 18, CSS.sand);
    // synergies
    const rx = colW + 20;
    this.text(rx, 0, 'SYNERGIES', 24, CSS.amber, FONT_TITLE);
    let ry = 34;
    const act = player.synergies ? [...player.synergies].map((id) => SYN_BY_ID[id]).filter(Boolean) : [];
    for (const syn of act) {
      this.text(rx, ry, syn.name.toUpperCase(), 18, SYN_KIND_COLOR[syn.kind] || '#f0d060', FONT_TITLE);
      const d = this.text(rx, ry + 22, syn.desc, 15, CSS.bone);
      d.setWordWrapWidth(colW - 40);
      ry += 26 + d.height;
    }
    if (!act.length) { this.text(rx, ry, 'None active.', 18, CSS.sand); ry += 30; }
    // tag progress
    ry += 10;
    this.text(rx, ry, 'BUILD', 24, CSS.amber, FONT_TITLE);
    ry += 34;
    const counts = tagCounts(player);
    for (const tag of Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 8)) {
      const need = Math.max(tagTarget(tag), counts[tag]), col = tagColor(tag);
      this.text(rx, ry, tagLabel(tag), 14, col, FONT_TITLE);
      const bx = rx + 150, bw = 200;
      const g = this.add(s.add.graphics());
      g.fillStyle(0x120c0a, 0.9).fillRect(bx, ry + 3, bw, 12);
      g.fillStyle(parseInt(col.slice(1), 16), 1).fillRect(bx, ry + 3, bw * Math.min(1, counts[tag] / need), 12);
      g.lineStyle(2, 0x6b4423, 1).strokeRect(bx, ry + 3, bw, 12);
      this.text(bx + bw + 10, ry, `${counts[tag]}/${need}`, 14, CSS.bone);
      ry += 24;
    }
    // curses
    ry += 10;
    const curses = player.curses || [];
    if (curses.length) {
      this.text(rx, ry, 'CURSES', 24, '#d63a2a', FONT_TITLE);
      ry += 34;
      for (const id of curses) { const c = CURSES[id]; this.text(rx, ry, c ? `${c.name}: ${c.desc}` : id, 15, '#e8a090'); ry += 22; }
    }
    if (player.stats && player.stats.curseHunted > 0) this.text(rx, ry, 'HUNTED: cursed elites find you more often', 15, '#e8a090');
  }

  destroy() { this.clear(); this.container.destroy(); }
}
