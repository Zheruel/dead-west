// The Codex (CHARACTERS_META D1): six tabs (BESTIARY, RELICS, OUTLAWS, LORE, DEEDS, RECORD) on a two-page ledger. Grid tabs show a 6x4 page of cells on the
// left and a detail sheet on the right that follows the cursor; unseen entries are black silhouettes with "???". Keys: Q / E tab, arrows / WASD browse,
// Z / X or PageUp / PageDown page, Enter equips a title (RECORD), Esc back. Everything is code-drawn when art is missing.
import Phaser from 'phaser';
import { W, FONT_TITLE, CSS, FLOORS } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { Save } from '../core/Save.js';
import { fmtTime } from '../core/util.js';
import { Meta } from '../meta/index.js';
import { nextRank } from '../meta/ranks.js';
import { ACHIEVEMENTS } from '../meta/achievements.js';
import { UNLOCKS, UNLOCK_BY_ID } from '../meta/unlocks.js';
import { LORE } from '../meta/lore.js';
import { BIOS } from '../data/story/bestiary.js';
import { itemLore } from '../data/story/lore_items.js';
import { causeOf } from '../data/story/epitaphs.js';
import { ENEMY_TEXT, BOSS_TEXT, MINI_TEXT, WORLD, WORLD_KINDS, mergeBestiary, prettyId } from '../meta/codexText.js';
import { ENEMY_META } from '../enemies/registry.js';
import { BOSS_META } from '../bosses/registry.js';
import { allItems } from '../items/index.js';
import { TAGS } from '../items/tags.js';
import { synergiesFor, reqLabel } from '../items/synergies.js';
import { CHAR_ORDER, charDef } from '../data/characters.js';
import { title, body, inkText, INK, uiSfx, setOsCursor } from '../ui/UiKit.js';
import TabBar from '../ui/TabBar.js';
import AchievementToast from '../ui/AchievementToast.js';
import { backdrop, panel, silhouette, metaIcon, padlock, starIcon, riderToken, itemIcon } from '../ui/Silhouette.js';

// optional story bestiary (chapter-2 lines): merged when the module exists
try {
  for (const m of Object.values(import.meta.glob('../data/story/bestiary.js', { eager: true }))) mergeBestiary(m);
} catch (e) { /* not present */ }

const TAB_LIST = [{ id: 'bestiary', label: 'BESTIARY', count: '' }, { id: 'relics', label: 'RELICS', count: '' }, { id: 'outlaws', label: 'OUTLAWS', count: '' }, { id: 'lore', label: 'LORE', count: '' }, { id: 'deeds', label: 'DEEDS', count: '' }, { id: 'record', label: 'RECORD', count: '' }];
const COLS = 6, ROWS = 4, PER = COLS * ROWS, CELL = 96, STEP = 116, STEPY = 130, GX = 118, GY = 226;
const DX = 1110; // detail page centre
const DW = 470;
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const num = (n) => Math.round(n).toLocaleString('en-US');
const bossText = (id) => { const t = BOSS_TEXT[id] || {}; return t.lore || !BIOS[id] ? t : { ...t, lore: BIOS[id] }; };
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

export default class CodexScene extends Phaser.Scene {
  constructor() { super('Codex'); }

  init(data) { this.leaving = false; this.tabId = (data && data.tab) || 'bestiary'; this.sel = 0; this.page = 0; }

  create() {
    setOsCursor(this.game, '');
    this.cameras.main.fadeIn(300, 13, 8, 6);
    backdrop(this, 'ui_codex_bg', { dim: 0.45 });
    this.pageL = panel(this, 440, 500, 800, 730, { alpha: 1 });
    this.pageR = panel(this, DX, 500, 560, 730, { alpha: 1 });
    this.content = this.add.container(0, 0).setDepth(2);
    this.detailC = this.add.container(0, 0).setDepth(3);
    this.cursor = this.add.graphics().setDepth(4);
    this.footer = this.add.text(W / 2, 938, '', body(16, '#c9b48a', { strokeThickness: 3 })).setOrigin(0.5);
    this.counts = {};
    this.cache = {};
    this.tabs = new TabBar(this, { x: W / 2, y: 56, w: 1200, tabs: TAB_LIST, onChange: (id, i, silent) => this.showTab(id), depth: 20, size: 22, active: Math.max(0, TAB_LIST.findIndex((t) => t.id === this.tabId)) });
    for (const t of TAB_LIST) { const c = this.entriesFor(t.id); if (c && c.entries) this.setCount(t.id, c.entries); }
    this.key = (e) => this.onKey(e);
    this.input.keyboard.on('keydown', this.key);
    this.wheel = (p, o, dx, dy) => { if (this.mode === 'grid') this.flip(dy > 0 ? 1 : -1); };
    this.input.on('wheel', this.wheel);
    this.events.once('shutdown', () => { this.input.keyboard.off('keydown', this.key); this.input.off('wheel', this.wheel); });
    this.toasts = new AchievementToast(this, { hold: false });
  }

  // ------------------------------------------------------------------------------------------------ data
  /** Entries of a grid tab (cached per visit): [{id, stage 0..3, name, ...}]. Non-grid tabs return {mode}. */
  entriesFor(id) {
    if (this.cache[id]) return this.cache[id];
    let r;
    if (id === 'bestiary') r = { mode: 'grid', entries: this.bestiary() };
    else if (id === 'relics') r = { mode: 'grid', entries: this.relics() };
    else if (id === 'outlaws') r = { mode: 'grid', entries: this.outlaws() };
    else if (id === 'lore') r = { mode: 'grid', entries: this.lore() };
    else if (id === 'deeds') r = { mode: 'deeds', entries: ACHIEVEMENTS.map((a) => ({ id: a.id, stage: Meta.earned(a.id) ? 1 : 0, a })) };
    else r = { mode: 'record', entries: [] };
    this.cache[id] = r;
    return r;
  }

  setCount(id, entries) {
    const i = TAB_LIST.findIndex((t) => t.id === id);
    if (i < 0 || id === 'record' || !this.tabs) return; // the TabBar fires onChange from its own constructor
    this.tabs.setCount(i, `${entries.filter((e) => e.stage >= 1).length} / ${entries.length}`);
  }

  bestiary() {
    const codex = Save.get().codex.enemies;
    return Object.keys(ENEMY_META).map((id) => {
      const m = ENEMY_META[id];
      const st = Meta.enemyStage(id);
      const t = ENEMY_TEXT[id] || { name: prettyId(id), lore: '', tip: '' };
      return { id, kind: 'enemy', stage: st, m, t, kills: (codex[id] && codex[id].kills) || 0, name: t.name || prettyId(id) };
    });
  }

  relics() {
    const list = allItems().filter((d) => !d.charOnly);
    const riders = allItems().filter((d) => d.charOnly);
    return [...list, ...riders].map((def) => {
      const st = Meta.itemStage(def.id);
      let locked = false, hint = '';
      if (def.gate && !Meta.isUnlocked(`gate:${def.gate}`)) {
        locked = true;
        const u = UNLOCK_BY_ID[`gate:${def.gate}`];
        hint = u ? `Unlocked by: ${u.hint}` : `Unlocked by: ${def.gate}`;
      }
      return { id: def.id, kind: 'item', def, stage: st, locked, hint, name: def.name, rider: def.charOnly || null };
    });
  }

  outlaws() {
    const out = [];
    const cb = Save.get().codex.bosses, cm = Save.get().codex.minis;
    for (const id of Object.keys(BOSS_META)) {
      const m = BOSS_META[id];
      if (m.mini) continue;
      out.push({ id, kind: 'boss', m, stage: Meta.bossStage(id), rec: cb[id] || null, name: m.name, tx: bossText(id) });
    }
    for (const id of Object.keys(BOSS_META)) {
      const m = BOSS_META[id];
      if (!m.mini) continue;
      out.push({ id, kind: 'mini', m, stage: cm[id] ? 2 : 0, rec: null, name: m.name, tx: MINI_TEXT[id] || {} });
    }
    return out;
  }

  lore() {
    const out = LORE.map((l) => ({ id: l.id, kind: 'lore', l, stage: Meta.loreUnlocked(l.id) ? 2 : 0, name: l.title }));
    const cx = Save.get().codex;
    for (const [kind] of WORLD_KINDS) {
      for (const [id, [name, line]] of Object.entries(WORLD[kind])) out.push({ id, kind: 'world', wk: kind, stage: cx[kind] && cx[kind][id] ? 1 : 0, name, line });
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------------ tab switching
  showTab(id) {
    this.tabId = id;
    const r = this.entriesFor(id);
    this.mode = r.mode;
    this.entries = r.entries;
    this.sel = 0; this.page = 0;
    this.setCount(id, this.entries);
    this.render();
  }

  clear() {
    this.content.removeAll(true);
    this.detailC.removeAll(true);
    this.cursor.clear();
  }

  render() {
    this.clear();
    if (this.mode === 'grid') this.renderGrid();
    else if (this.mode === 'deeds') this.renderDeeds();
    else this.renderRecord();
    this.footer.setText(this.mode === 'grid'
      ? `Q / E  tab     ARROWS  browse     Z / X  page${this.tabId === 'lore' ? '     ENTER  reread' : ''}     ESC  back`
      : this.mode === 'deeds' ? 'Q / E  tab     Z / X  page     ESC  back' : 'Q / E  tab     UP / DOWN  choose a title     ENTER  equip     ESC  back');
  }

  // ------------------------------------------------------------------------------------------------ grid tabs
  pages() { return Math.max(1, Math.ceil(this.entries.length / PER)); }

  renderGrid() {
    const c = this.content, start = this.page * PER;
    this.cells = [];
    for (let k = 0; k < PER; k++) {
      const e = this.entries[start + k];
      if (!e) break;
      const x = GX + (k % COLS) * STEP + CELL / 2, y = GY + Math.floor(k / COLS) * STEPY + CELL / 2;
      const bg = this.add.graphics();
      bg.fillStyle(0x2a1810, e.stage >= 1 ? 0.28 : 0.4).fillRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 10).lineStyle(2, 0x6b4423, 0.9).strokeRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 10);
      c.add(bg);
      this.cell(e, x, y, c);
      const zone = this.add.zone(x, y, CELL, CELL).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.setSel(start + k, true));
      zone.on('pointerdown', () => this.setSel(start + k));
      c.add(zone);
      this.cells.push({ x, y });
    }
    if (this.pages() > 1) c.add(this.add.text(440, 780, `PAGE ${this.page + 1} / ${this.pages()}`, inkText(18, '#5a1a10')).setOrigin(0.5));
    this.sel = Math.min(Math.max(this.sel, start), Math.min(this.entries.length, start + PER) - 1);
    this.drawSel();
  }

  /** One grid cell: art (silhouette until seen), padlock for gated relics. */
  cell(e, x, y, c) {
    let o = null;
    if (e.kind === 'enemy') {
      o = Assets.makeSprite(this, x, y + 40, `enemy_${e.id}`, 0);
      o.setOrigin(0.5, 1).setScale(Math.min(1.1, 84 / Math.max(o.width, o.height)));
    } else if (e.kind === 'item') {
      o = itemIcon(this, x, y, e.def, 0.84);
    } else if (e.kind === 'boss' || e.kind === 'mini') {
      if (e.kind === 'boss') o = Assets.makeImage(this, x, y, e.m.portrait || `portrait_${e.id}`).setDisplaySize(84, 84);
      else o = this.miniArt(e, x, y, 84);
    } else if (e.kind === 'lore') {
      o = this.scrollGlyph(x, y, e.stage >= 1);
    } else {
      o = this.add.text(x, y, (WORLD_KINDS.find((k) => k[0] === e.wk) || ['', '?'])[1].charAt(0), { fontFamily: FONT_TITLE, fontSize: '44px', color: '#2a1810' }).setOrigin(0.5);
    }
    if (e.stage < 1) { if (o.setTintFill) silhouette(o); else o.setAlpha(0.45); }
    c.add(o);
    if (e.locked) c.add(padlock(this, x + 30, y + 30, 0.34));
    if (e.kind === 'item' && e.rider && e.stage >= 1) c.add(this.add.text(x - 40, y - 42, e.rider.charAt(0).toUpperCase(), body(14, CSS.amber)).setOrigin(0, 0.5));
  }

  /** Mini-boss picture: the champion's own art when a sprite exists, else a code-drawn initials badge. */
  miniArt(e, x, y, size) {
    const key = ['mini_', 'boss_', 'enemy_'].map((p) => p + e.id).find((k) => Assets.has(k));
    if (key) { const sp = Assets.makeSprite(this, x, y + size / 2, key, 0).setOrigin(0.5, 1); return sp.setScale(size / Math.max(sp.width, sp.height)); }
    return this.add.text(x, y, e.name.replace(/^(THE|OL') /i, '').split(' ').map((w) => w.charAt(0)).join('').slice(0, 2), { fontFamily: FONT_TITLE, fontSize: `${Math.round(size * 0.6)}px`, color: '#2a1810' }).setOrigin(0.5);
  }

  scrollGlyph(x, y, on) {
    const g = this.add.graphics();
    g.fillStyle(on ? 0xe8dcc0 : 0x1a100c, on ? 1 : 0.6).fillRoundedRect(x - 30, y - 34, 60, 68, 6).lineStyle(3, 0x2a1810, 1).strokeRoundedRect(x - 30, y - 34, 60, 68, 6);
    if (on) for (let i = 0; i < 5; i++) g.lineStyle(2, 0x6b4423, 0.8).lineBetween(x - 20, y - 22 + i * 12, x + 20 - (i % 2) * 8, y - 22 + i * 12);
    return g;
  }

  setSel(i, quiet) {
    if (i === this.sel && this.detailC.length) return;
    if (!quiet) uiSfx.move();
    this.sel = i;
    const pg = Math.floor(i / PER);
    if (pg !== this.page) { this.page = pg; this.render(); return; }
    this.drawSel();
  }

  drawSel() {
    const k = this.sel - this.page * PER, cell = this.cells && this.cells[k];
    this.cursor.clear();
    if (cell) this.cursor.lineStyle(5, 0xf0a640, 1).strokeRoundedRect(cell.x - CELL / 2 - 4, cell.y - CELL / 2 - 4, CELL + 8, CELL + 8, 12);
    this.detailC.removeAll(true);
    const e = this.entries[this.sel];
    if (e) this.detail(e);
  }

  T(str, x, y, style, ox = 0.5, oy = 0) {
    const t = this.add.text(x, y, str, style).setOrigin(ox, oy);
    this.detailC.add(t);
    return t;
  }

  detail(e) {
    const known = e.stage >= 1;
    const wrap = { wordWrap: { width: DW } };
    const cx = DX, top = 214;
    this.T(known ? e.name.toUpperCase() : '???', cx, top, title(32, '#2a1810', { strokeThickness: 0, ...wrap, align: 'center' }));
    if (e.kind === 'enemy') this.detailEnemy(e, cx, top);
    else if (e.kind === 'item') this.detailItem(e, cx, top);
    else if (e.kind === 'boss' || e.kind === 'mini') this.detailOutlaw(e, cx, top);
    else if (e.kind === 'lore') this.detailLore(e, cx, top);
    else this.detailWorld(e, cx, top);
  }

  detailEnemy(e, cx, top) {
    const s = Assets.makeSprite(this, cx, top + 250, `enemy_${e.id}`, 0).setOrigin(0.5, 1);
    s.setScale(180 / Math.max(s.width, s.height));
    if (e.stage < 1) silhouette(s);
    this.detailC.add(s);
    let y = top + 280;
    const fl = e.m.floors && e.m.floors.length ? `FLOOR ${e.m.floors.join(', ')}` : 'EVENT / SUMMONED';
    this.T(e.stage >= 1 ? fl : 'FLOOR ?', cx, y, inkText(20, '#5a1a10', { fontStyle: 'bold' })); y += 34;
    if (e.stage >= 2) {
      const tags = [...(e.m.tags || []), ...(e.m.flying ? ['flying'] : [])];
      this.T(`HP ${e.m.hp}     SPEED ${e.m.speed || 0}${tags.length ? `     ${tags.join(', ').toUpperCase()}` : ''}`, cx, y, inkText(20, INK)); y += 40;
      if (e.t.tip) { this.T('HOW TO KILL IT', cx, y, title(18, '#5a1a10', { strokeThickness: 0 })); y += 26; y += this.T(e.t.tip, cx, y, inkText(19, INK, { align: 'center', wordWrap: { width: DW } })).height + 20; }
    } else if (e.stage === 1) { this.T('HP ?     SPEED ?', cx, y, inkText(20, '#7a6a58')); y += 36; this.T('Slay 3 to learn its habits.', cx, y, inkText(18, '#7a6a58', { fontStyle: 'italic' })); y += 40; }
    if (e.stage >= 3) {
      if (e.t.lore) y += this.T(e.t.lore, cx, y, inkText(19, INK, { fontStyle: 'italic', align: 'center', wordWrap: { width: DW } })).height + 16;
      this.T(`SLAIN  ${num(e.kills)}`, cx, y, inkText(20, '#5a1a10', { fontStyle: 'bold' }));
    } else if (e.stage === 2) this.T(`SLAIN  ${num(e.kills)}   (15 to learn its story)`, cx, y, inkText(17, '#7a6a58'));
  }

  detailItem(e, cx, top) {
    const d = e.def, known = e.stage >= 1;
    const ic = itemIcon(this, cx, top + 120, d, 1.5);
    if (!known) silhouette(ic);
    this.detailC.add(ic);
    if (e.locked) this.detailC.add(padlock(this, cx + 70, top + 180, 0.7));
    let y = top + 210;
    if (e.locked) { this.T(e.hint, cx, y, inkText(20, '#5a1a10', { align: 'center', fontStyle: 'bold', wordWrap: { width: DW } })); return; }
    if (!known) { this.T('Not yet seen.', cx, y, inkText(19, '#7a6a58', { fontStyle: 'italic' })); return; }
    if (e.stage < 2) { this.T('Pick it up to learn more.', cx, y, inkText(19, '#7a6a58', { fontStyle: 'italic' })); return; }
    y += this.T(d.desc, cx, y, inkText(21, INK, { align: 'center', wordWrap: { width: DW } })).height + 14;
    if (d.tags && d.tags.length) { this.T(d.tags.map((t) => (TAGS[t] ? TAGS[t].label : t.toUpperCase())).join('   '), cx, y, inkText(17, '#5a1a10', { fontStyle: 'bold' })); y += 28; }
    const where = d.charOnly ? `${charDef(d.charOnly).name}'s relic` : (d.pool || []).filter((p) => p !== 'c2').join(', ') || 'special';
    this.T(`FOUND IN: ${where.toUpperCase()}`, cx, y, inkText(16, INK)); y += 30;
    const lore = itemLore(d.id, d);
    if (lore) y += this.T(`"${lore}"`, cx, y, inkText(18, '#6b4423', { fontStyle: 'italic', align: 'center', wordWrap: { width: DW } })).height + 12;
    const syn = synergiesFor(d.id).slice(0, 3);
    if (syn.length) {
      this.T('SYNERGIES', cx, y, title(17, '#5a1a10', { strokeThickness: 0 })); y += 24;
      for (const s of syn) y += this.T(`${s.name}: ${reqLabel(s)}`, cx, y, inkText(15, INK, { align: 'center', wordWrap: { width: DW } })).height + 4;
    }
  }

  detailOutlaw(e, cx, top) {
    const known = e.stage >= 1;
    let pic;
    if (e.kind === 'boss') pic = Assets.makeImage(this, cx, top + 230, e.m.portrait || `portrait_${e.id}`).setDisplaySize(330, 330);
    else pic = this.miniArt(e, cx, top + 230, 300);
    if (!known) { if (pic.setTintFill) silhouette(pic); else pic.setAlpha(0.35); }
    this.detailC.add(pic);
    let y = top + 410;
    if (!known) { this.T('Not yet met.', cx, y, inkText(19, '#7a6a58', { fontStyle: 'italic' })); return; }
    this.T(e.m.title ? `"${e.m.title}"` : '', cx, y, inkText(20, '#5a1a10', { fontStyle: 'italic' })); y += 34;
    const rec = e.rec;
    if (e.stage >= 2) {
      this.T(`HP ${e.m.hp}     ${e.kind === 'boss' ? `FLOOR ${e.m.floor}` : `CHAMPION, FLOOR ${e.m.floor}`}${rec && rec.bestFight ? `     BEST ${fmtTime(rec.bestFight)}` : ''}`, cx, y, inkText(19, INK)); y += 32;
      if (e.tx.attacks) { this.T(e.tx.attacks.join('  -  '), cx, y, inkText(16, INK, { align: 'center', wordWrap: { width: DW } })); y += 40; }
      if (e.tx.lore) y += this.T(e.tx.lore, cx, y, inkText(18, INK, { fontStyle: 'italic', align: 'center', wordWrap: { width: DW } })).height + 10;
    } else this.T('Defeat it to learn more.', cx, y, inkText(18, '#7a6a58', { fontStyle: 'italic' }));
    if (e.stage >= 3 && e.tx.tip) {
      this.detailC.add(starIcon(this, cx - 210, y + 12, 'gold', 0.4));
      this.T(`SHERIFF'S NOTE: ${e.tx.tip}`, cx + 10, y, inkText(16, '#2a5a10', { fontStyle: 'bold', align: 'center', wordWrap: { width: DW - 50 } }));
    }
  }

  detailLore(e, cx, top) {
    const on = e.stage >= 1, l = e.l;
    if (!on) {
      this.T('This page is still blank.', cx, top + 90, inkText(20, '#7a6a58', { fontStyle: 'italic' }));
      this.T(l.hint, cx, top + 150, inkText(22, '#5a1a10', { align: 'center', fontStyle: 'bold', wordWrap: { width: DW } }));
      return;
    }
    const t = this.T(l.text, cx, top + 80, inkText(22, INK, { align: 'center', wordWrap: { width: 440 }, lineSpacing: 6 }));
    if (l.reread) {
      const b = this.T('[ENTER]  REREAD', cx, top + 100 + t.height, title(24, '#5a1a10', { strokeThickness: 0 }));
      b.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.reread(l));
    }
  }

  /** LORE Reread: replay the cutscene standalone (clean, non-hell), then come back to the LORE tab. */
  reread(l) {
    if (this.leaving || !l || !l.reread) return;
    this.leaving = true;
    uiSfx.back();
    this.cameras.main.fadeOut(220, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Cutscene', { id: l.reread, ctx: { char: 'gunslinger', clean: true, hell: false }, next: { scene: 'Codex', data: { tab: 'lore' } } }));
  }

  detailWorld(e, cx, top) {
    const label = (WORLD_KINDS.find((k) => k[0] === e.wk) || ['', ''])[1];
    this.T(label, cx, top + 50, title(16, '#5a1a10', { strokeThickness: 0 }));
    if (e.stage < 1) { this.T('Not yet encountered.', cx, top + 130, inkText(20, '#7a6a58', { fontStyle: 'italic' })); return; }
    this.T(e.line, cx, top + 100, inkText(22, INK, { align: 'center', wordWrap: { width: 440 }, lineSpacing: 6 }));
  }

  // ------------------------------------------------------------------------------------------------ DEEDS
  renderDeeds() {
    const c = this.content, per = 10, pages = Math.ceil(this.entries.length / per);
    this.page = Math.min(this.page, pages - 1);
    const start = this.page * per, save = Save.get();
    for (let k = 0; k < per; k++) {
      const e = this.entries[start + k];
      if (!e) break;
      const a = e.a, earned = e.stage >= 1, col = k < 5 ? 0 : 1, row = k % 5;
      const x = col ? 850 : 90, w = col ? 520 : 700, y = 176 + row * 130;
      const g = this.add.graphics();
      g.fillStyle(earned ? 0x5a3a12 : 0x2a1810, earned ? 0.22 : 0.14).fillRoundedRect(x, y, w, 118, 10).lineStyle(2, earned ? 0xa06a10 : 0x6b4423, 0.8).strokeRoundedRect(x, y, w, 118, 10);
      c.add(g);
      const hide = a.hidden && !earned;
      const np = a.np || 0;
      const badge = hide ? padlock(this, x + 52, y + 59, 0.6) : metaIcon(this, x + 52, y + 59, np >= 60 ? 'star_gold' : np >= 25 ? 'star_silver' : 'star_tin', 0.8);
      if (!earned && !hide) badge.setTint(0x666666).setAlpha(0.6);
      c.add(badge);
      c.add(this.add.text(x + 102, y + 12, hide ? '???' : a.name.toUpperCase(), title(22, earned ? '#2a1810' : '#5a4a3a', { strokeThickness: 0 })));
      c.add(this.add.text(x + 102, y + 42, hide ? 'A secret deed' : a.desc, inkText(16, INK, { wordWrap: { width: w - 130 } })));
      const rew = [`+${np} NP`, ...a.reward.map((r) => { const u = UNLOCK_BY_ID[r]; return u ? u.label : r; })];
      c.add(this.add.text(x + 102, y + 88, hide ? '' : rew.join('   '), inkText(14, '#8a1c14', { fontStyle: 'bold' })).setOrigin(0, 0.5));
      if (earned) {
        const d = new Date(save.ach[a.id]);
        const stamp = this.add.text(x + w - 16, y + 104, `EARNED ${Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : ''}`, inkText(13, '#2a5a10', { fontStyle: 'bold' })).setOrigin(1, 0.5);
        c.add(stamp);
      } else if (!hide) {
        let pr = null;
        try { pr = Meta.achProgress(a); } catch (er) { pr = null; }
        if (pr) {
          const bw = 150, bx = x + w - 16 - bw, by = y + 106;
          const bar = this.add.graphics();
          bar.fillStyle(0x120c0a, 0.7).fillRect(bx, by - 6, bw, 12).fillStyle(0xd63a2a, 1).fillRect(bx + 1, by - 5, (bw - 2) * (pr[1] ? pr[0] / pr[1] : 0), 10).lineStyle(2, 0x2a1810, 1).strokeRect(bx, by - 6, bw, 12);
          c.add(bar);
          c.add(this.add.text(bx - 8, by, `${num(pr[0])} / ${num(pr[1])}`, inkText(13, INK)).setOrigin(1, 0.5));
        }
      }
    }
    c.add(this.add.text(W / 2, 892, `PAGE ${this.page + 1} / ${pages}   -   ${this.entries.filter((x) => x.stage >= 1).length} / ${this.entries.length} EARNED`, inkText(18, '#f0e0c0')).setOrigin(0.5));
  }

  // ------------------------------------------------------------------------------------------------ RECORD
  renderRecord() {
    const c = this.content, save = Save.get(), st = save.stats;
    const A = (o) => { c.add(o); return o; };
    A(this.add.text(440, 168, 'THE LEDGER', title(34, '#2a1810', { strokeThickness: 0 }))).setOrigin(0.5, 0);
    const fastN = save.best.time.normal, fastH = save.best.time.hell;
    const rows = [
      ['Rides started', num(st.runs)], ['Rides ended', num(st.wins + st.deaths)], ['Rides won', num(st.wins)], ['Times hanged', num(st.deaths)],
      ['Enemies slain', num(st.kills)], ['Most kills in a ride', num(save.best.killsInRun)], ['Deepest floor', save.best.floor ? `${save.best.floor}${FLOORS[save.best.floor] ? ` - ${FLOORS[save.best.floor].name}` : ''}` : '-'],
      ['Fastest win', `${fastN ? fmtTime(fastN) : '-'}  /  ${fastH ? `${fmtTime(fastH)} Hell` : '- Hell'}`], ['Time in the saddle', fmtTime(st.playTime || 0)],
      ['Coins collected', num(st.coinsCollected)], ['Coins spent', num(st.coinsSpent)], ['Secrets found', num(st.secrets)], ['Deals made', num(st.deals)],
      ['Contracts done', num(st.bountiesDone)], ['Dailies ridden', num(st.dailyRuns)], ['Best daily streak', num(save.daily.bestStreak)],
    ];
    const x0 = 100, x1 = 780, y0 = 224, step = 39;
    rows.forEach(([k, v], i) => {
      const y = y0 + i * step;
      const lab = A(this.add.text(x0, y, k, inkText(21, INK))).setOrigin(0, 0.5);
      const val = A(this.add.text(x1, y, v, inkText(21, '#5a1a10', { fontStyle: 'bold' }))).setOrigin(1, 0.5);
      const dots = A(this.add.graphics());
      dots.fillStyle(0x2a1810, 0.45);
      for (let x = x0 + lab.width + 10; x < x1 - val.width - 10; x += 9) dots.fillRect(x, y + 8, 2.5, 2.5);
    });
    // right page: notoriety, riders, titles, history
    const rx = 850, rw = 520;
    const np = Meta.np(), r = Meta.rank(), nx = nextRank(np);
    A(this.add.text(DX, 168, r.title.toUpperCase(), title(30, '#2a1810', { strokeThickness: 0 }))).setOrigin(0.5, 0);
    const bar = A(this.add.graphics());
    bar.fillStyle(0x120c0a, 0.7).fillRect(rx + 20, 216, rw - 40, 12).fillStyle(0xd63a2a, 1).fillRect(rx + 21, 217, (rw - 42) * (nx ? (np - r.np) / (nx.np - r.np) : 1), 10).lineStyle(2, 0x2a1810, 1).strokeRect(rx + 20, 216, rw - 40, 12);
    A(this.add.text(DX, 240, `NP ${num(np)}${nx ? ` / ${num(nx.np)}  -  next: ${nx.title}` : '  -  MAX RANK'}`, inkText(16, INK))).setOrigin(0.5, 0);
    CHAR_ORDER.forEach((id, i) => {
      const x = rx + 70 + i * 128, ch = save.chars[id], unlocked = Meta.isCharUnlocked(id);
      A(riderToken(this, x, 316, id, 84, { locked: !unlocked }));
      A(this.add.text(x, 368, unlocked ? `${ch.runs} runs / ${ch.wins} wins` : 'LOCKED', inkText(13, INK))).setOrigin(0.5, 0);
      A(this.add.text(x, 384, unlocked ? `best floor ${ch.bestFloor}` : '', inkText(13, INK))).setOrigin(0.5, 0);
      ['tin', 'silver', 'gold'].forEach((tier, j) => { const on = unlocked && ch.marks[['undertaker', 'final', 'hell'][j]]; const s = A(starIcon(this, x - 24 + j * 24, 414, tier, 0.24)); if (!on) s.setTint(0x555555).setAlpha(0.3); });
    });
    // titles
    A(this.add.text(rx + 20, 446, 'TITLE', title(20, '#5a1a10', { strokeThickness: 0 })));
    this.titles = [{ id: 'rank', label: `Rank: ${r.title}` }, ...UNLOCKS.filter((u) => u.type === 'title' && Save.unlocked(u.id)).map((u) => ({ id: u.id.slice(6), label: u.label }))];
    this.tsel = Math.max(0, this.titles.findIndex((t) => t.id === save.settings.title));
    this.titleObjs = [];
    this.titles.slice(0, 5).forEach((t, i) => {
      const o = A(this.add.text(rx + 30, 474 + i * 26, '', inkText(18, INK)));
      this.titleObjs.push(o);
    });
    this.drawTitles();
    // history
    A(this.add.text(rx + 20, 612, 'LAST RIDES', title(20, '#5a1a10', { strokeThickness: 0 })));
    const hist = [...save.history].reverse().slice(0, 9);
    if (!hist.length) A(this.add.text(rx + 30, 646, 'No rides yet.', inkText(17, '#7a6a58', { fontStyle: 'italic' })));
    hist.forEach((h, i) => {
      const y = 646 + i * 22, d = new Date(h.t);
      const t = (x, s, ox = 0) => A(this.add.text(x, y, s, inkText(14, h.won ? '#2a5a10' : INK))).setOrigin(ox, 0.5);
      t(rx + 24, Number.isFinite(d.getTime()) ? d.toISOString().slice(5, 10) : '');
      t(rx + 84, ({ gunslinger: 'GUN', preacher: 'PRE', hunter: 'HUN', queen: 'QUE' })[h.char] || '?');
      t(rx + 132, `F${h.floor}`);
      t(rx + 190, money(h.reward || 0));
      t(rx + rw - 8, h.won ? 'WIN' : causeOf(h.killedBy).slice(0, 18), 1);
    });
  }

  drawTitles() {
    const first = Math.max(0, Math.min(this.tsel - 2, this.titles.length - this.titleObjs.length));
    this.titleObjs.forEach((o, i) => {
      const t = this.titles[first + i];
      if (!t) { o.setText(''); return; }
      const cur = Save.settings().title === t.id, on = first + i === this.tsel;
      o.setText(`${on ? '> ' : '  '}${t.label}${cur ? '   (equipped)' : ''}`).setColor(on ? '#8a1c14' : INK).setFontStyle(cur ? 'bold' : 'normal');
    });
  }

  // ------------------------------------------------------------------------------------------------ input
  flip(d) {
    if (this.mode === 'grid') {
      const pg = Math.max(0, Math.min(this.pages() - 1, this.page + d));
      if (pg === this.page) return;
      uiSfx.move();
      this.page = pg;
      this.sel = Math.min(this.entries.length - 1, pg * PER + (this.sel % PER));
      this.render();
    } else if (this.mode === 'deeds') {
      const pages = Math.ceil(this.entries.length / 10), pg = Math.max(0, Math.min(pages - 1, this.page + d));
      if (pg === this.page) return;
      uiSfx.move();
      this.page = pg;
      this.render();
    }
  }

  onKey(e) {
    if (this.leaving || e.repeat) return;
    const c = e.code;
    if (c === 'Escape' || c === 'Backspace') { this.back(); return; }
    if (c === 'KeyZ' || c === 'PageUp') { this.flip(-1); return; }
    if (c === 'KeyX' || c === 'PageDown') { this.flip(1); return; }
    if (this.mode === 'grid') {
      const n = this.entries.length;
      let i = this.sel;
      if ((c === 'Enter' || c === 'NumpadEnter') && this.tabId === 'lore') {
        const en = this.entries[this.sel];
        if (en && en.stage >= 1 && en.l && en.l.reread) this.reread(en.l);
        return;
      }
      if (c === 'ArrowLeft' || c === 'KeyA') i -= (i % COLS) ? 1 : 0;
      else if (c === 'ArrowRight' || c === 'KeyD') i += (i % COLS < COLS - 1 && i + 1 < n) ? 1 : 0;
      else if (c === 'ArrowUp' || c === 'KeyW') i -= COLS;
      else if (c === 'ArrowDown' || c === 'KeyS') i += COLS;
      else return;
      if (i < 0 || i >= n) return;
      if (i !== this.sel) this.setSel(i);
    } else if (this.mode === 'deeds') {
      if (c === 'ArrowLeft' || c === 'KeyA') this.flip(-1); else if (c === 'ArrowRight' || c === 'KeyD') this.flip(1);
    } else if (this.mode === 'record') {
      if (c === 'ArrowUp' || c === 'KeyW') { this.tsel = Math.max(0, this.tsel - 1); uiSfx.move(); this.drawTitles(); }
      else if (c === 'ArrowDown' || c === 'KeyS') { this.tsel = Math.min(this.titles.length - 1, this.tsel + 1); uiSfx.move(); this.drawTitles(); }
      else if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') {
        const t = this.titles[this.tsel];
        if (t) { Save.setSetting('title', t.id); Sfx.play('menu_select', { vol: 0.8 }); this.drawTitles(); }
      }
    }
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    uiSfx.back();
    this.cameras.main.fadeOut(220, 13, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
  }
}
