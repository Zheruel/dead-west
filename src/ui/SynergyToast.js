// Synergy activation ribbon (ITEMS_V2 s5): code-drawn banner low on the screen with the kind label, name, cue line and the two item icons
// (pairs) or the tag chip (tag bonuses / capstones). Queued behind the item Banner so the pickup that caused it is read first.
// Instantiated by Banner (constructor / update / destroy forwarded), so HUDScene needs no wiring. Driven by 'synergy:activated'.
import Assets from '../core/Assets.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';
import Save from '../core/Save.js';
import { FONT_TITLE, FONT_BODY } from '../config.js';
import { SYN_KIND_COLOR, SYN_KIND_LABEL } from '../items/synergies.js';
import { getItem } from '../items/registry.js';
import { tagColor, tagLabel } from '../items/tags.js';

const X = 720, Y = 410, HOLD = 2600, W = 760, H = 150;
const hex = (css) => parseInt(css.slice(1), 16);

export default class SynergyToast {
  /** @param banner the item Banner (its `busy` / `queue` gate this toast) */
  constructor(hud, banner) {
    this.hud = hud;
    this.banner = banner;
    this.queue = [];
    this.busy = false;
    this.waiting = false;
    this.readyAt = 0;
    this.c = hud.add.container(X, Y).setDepth(61).setAlpha(0);
    this.bg = hud.add.graphics();
    this.kind = hud.add.text(0, -50, '', { fontFamily: FONT_TITLE, fontSize: '18px', color: '#f0d060', stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5);
    this.name = hud.add.text(0, -12, '', { fontFamily: FONT_TITLE, fontSize: '40px', color: '#fff0c8', stroke: '#120c0a', strokeThickness: 7 }).setOrigin(0.5);
    this.cue = hud.add.text(0, 40, '', { fontFamily: FONT_BODY, fontSize: '22px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 4, align: 'center', wordWrap: { width: W - 200 } }).setOrigin(0.5, 0);
    this.endL = null; this.endR = null;
    this.chipL = hud.add.text(-W / 2 + 70, 0, '', { fontFamily: FONT_TITLE, fontSize: '22px', color: '#fff', stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5).setVisible(false);
    this.chipR = hud.add.text(W / 2 - 70, 0, '', { fontFamily: FONT_TITLE, fontSize: '22px', color: '#fff', stroke: '#120c0a', strokeThickness: 5 }).setOrigin(0.5).setVisible(false);
    this.c.add([this.bg, this.kind, this.name, this.cue, this.chipL, this.chipR]);
    bus.scoped(hud, 'synergy:activated', (p) => { if (p && p.def) { this.queue.push(p.def); Save.codexSeen('synergies', p.def.id); } if (!this.busy) { this.waiting = true; this.readyAt = hud.time.now + 250; } }); // the pickup's own item:picked may follow in the same frame
  }

  /** The player's world position never matters for the ribbon; the ring pulse uses the game scene. */
  get g() { return this.hud.g; }

  /** Icon or chip for one end of the ribbon. */
  setEnd(side, def, tag, color) {
    const chip = side < 0 ? this.chipL : this.chipR;
    const key = side < 0 ? 'endL' : 'endR';
    if (this[key]) { this[key].destroy(); this[key] = null; }
    chip.setVisible(false);
    const x = side * (W / 2 - 70);
    if (def) {
      const ic = def.icon || { sheet: 'items_passive_a', name: def.id };
      this[key] = Assets.makeCell(this.hud, x, 0, ic.sheet, ic.name, 0.5).setScale(0.62);
      this.c.add(this[key]);
    } else if (tag) chip.setText(tagLabel(tag)).setColor(tagColor(tag)).setVisible(true);
    else chip.setText('').setVisible(false);
  }

  next() {
    const b = this.banner;
    if (this.hud.time.now < this.readyAt) { this.busy = false; this.waiting = true; return; }
    if (b && (b.busy || b.queue.length)) { this.busy = false; this.waiting = true; return; }
    const syn = this.queue.shift();
    if (!syn) { this.busy = false; return; }
    this.busy = true; this.waiting = false;
    const h = this.hud, cap = syn.kind === 'capstone';
    const col = SYN_KIND_COLOR[syn.kind] || '#f0d060';
    this.kind.setText(SYN_KIND_LABEL[syn.kind] || 'SYNERGY').setColor(col);
    this.name.setText(syn.name.toUpperCase()).setFontSize(syn.name.length > 20 ? 32 : 40);
    this.cue.setText(syn.cue || syn.desc || '');
    const n = syn.req.items;
    if (n && n.length === 2) { this.setEnd(-1, getItem(n[0])); this.setEnd(1, getItem(n[1])); }
    else {
      const t = syn.req.tags ? Object.keys(syn.req.tags)[0] : syn.req.anyTags ? syn.req.anyTags.of[0] : null;
      this.setEnd(-1, null, t); this.setEnd(1, null, t);
    }
    const c = hex(col);
    this.bg.clear().fillStyle(0x0d0806, 0.9).fillRoundedRect(-W / 2, -H / 2, W, H, 14).lineStyle(4, c, 1).strokeRoundedRect(-W / 2, -H / 2, W, H, 14)
      .lineStyle(2, c, 0.5).strokeRoundedRect(-W / 2 + 8, -H / 2 + 8, W - 16, H - 16, 10);
    Sfx.play('synergy_chime'); // alias of item_get@1.4 (AudioAliases), own MIX row
    if (cap) Sfx.play('room_clear');
    const g = this.g;
    if (g && g.fx) g.fx.flash(cap ? 0xff8a40 : 0xf0c040, cap ? 0.3 : 0.15); // honours settings.flash
    if (g && g.player && g.fx) g.fx.ringPulse(g.player.x, g.player.y, c, cap ? 150 : 90, cap ? 600 : 420, 0.8);
    if (cap && g && g.slowMo) g.slowMo(0.3, 0.3);
    h.tweens.killTweensOf(this.c);
    this.c.setAlpha(0).setY(Y + 20).setScale(0.6);
    h.tweens.add({ targets: this.c, alpha: 1, y: Y, scale: 1, duration: 350, ease: 'Back.easeOut' });
    h.tweens.add({ targets: this.c, alpha: 0, y: Y - 16, delay: HOLD, duration: 380, onComplete: () => this.next() });
  }

  update() {
    if (this.waiting && !this.busy) this.next(); // retry once the item banner has finished
  }
  destroy() { this.hud.tweens.killTweensOf(this.c); this.c.destroy(); }
}
