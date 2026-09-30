// CHAIN GANG (floor 5, CHAPTER2 s3 enemy 6): a snake of four shackled convicts spawned from ONE template slot: the head plus 3 links, 70 px apart
// along the head's trail. Every body is its own Enemy (contact damage, hp, loot); links hold a `leader` reference and follow the breadcrumb
// path. The head steers at 150 px/s. Every 5 s it stops for 0.7 s (pose 4, warn line toward the player; the line tracks for 0.3 s, then locks),
// then charges 430 px/s for 0.9 s with the links trailing behind it like a moving wall. When the head dies the next link takes over: speed x1.3
// and no more charges. Elite affixes apply to the head only (the links are `chainLink` bodies). Counts as 4 enemies (threat 4).
import Enemy from '../Enemy.js';
import { registerEnemy } from '../registry.js';
import { Sfx } from '../../core/Audio.js';
import { Assets } from '../../core/Assets.js';
import { subRng } from '../../core/rng.js';
import { DEPTH, ROOM } from '../../config.js';
import { Trail } from '../parts/fe-e4/trail.js';

const SPACING = 70; // px between bodies along the trail
const LINK_HP = 10; // base hp of a link (head = meta.hp 12)
const WIND_T = 0.7; // stop + warn line
const LOCK_AT = 0.3; // the line follows the player for this long, then locks
const CHARGE_T = 0.9;
const CHARGE_CD = 5;
const RECOVER_T = 0.3; // dazed after ramming a wall
const PROMOTE_MULT = 1.3;
const FOLLOW_MAX = 720; // links catch up at most this fast
const LINE_W = 56;
const LINK_TINTS = [0xd6cdbc, 0xc4ccd2, 0xd2c2c8];
const HEAD_TINT = 0xffb0a0; // promoted (unchained) head
const CHAIN_COL = 0x3a3a42;

/** Shared by the bodies of one gang: living members in order (head first) + the head's trail. */
class Chain {
  constructor() {
    this.members = [];
    this.trail = new Trail();
    this.pt = { x: 0, y: 0 };
  }

  /** Re-index the members and rebuild the trail as the polyline through the living bodies (tail first). */
  rebuild() {
    const m = this.members;
    this.trail.clear();
    for (let i = m.length - 1; i >= 0; i--) this.trail.push(m[i].x, m[i].y);
    for (let i = 0; i < m.length; i++) { m[i].ci = i; m[i].leader = i ? m[i - 1] : null; if (m[i].sprite) m[i].refreshTint(); }
  }

  remove(e) {
    const i = this.members.indexOf(e);
    if (i < 0) return;
    this.members.splice(i, 1);
    this.rebuild();
  }
}

class ChainGang extends Enemy {
  init(opts) {
    this.rng = subRng('fe4', this.id, this.floor, Math.round(this.x), Math.round(this.y), this.scene.enemies.length);
    this.leader = null;
    this.ci = 0;
    this.chainImg = null;
    this.aimBase = null; this.aimFill = null;
    this.aimAng = 0;
    this.promoted = false;
    this.wt = 0; this.ct = 0;
    this.timer = 0;
    this.chargeSpeed = this.meta.charge ?? 430;
    if (opts.chain) { // a link
      this.chain = opts.chain;
      this.isHead = false;
      this.chain.members.push(this);
      this.chainImg = this.scene.add.image(this.x, this.y, 'px').setOrigin(0, 0.5).setTint(CHAIN_COL).setVisible(false);
      this.setState('follow');
      return;
    }
    // the head builds the whole gang
    this.chain = new Chain();
    this.chain.members.push(this);
    this.isHead = true;
    this.setState('chase');
    this.timer = this.cd(this.rng.float(2.4, 3.6));
    this.buildLinks(opts);
  }

  /** Place the links behind the head along the first free direction (toward the room centre first), or stacked on the head if boxed in. */
  buildLinks(opts) {
    const s = this.scene, room = s.room;
    const n = this.meta.links ?? 3;
    const lr = this.radius * 0.7;
    let ang = Math.atan2(ROOM.cy - this.y, ROOM.cx - this.x);
    if (room) {
      const base = ang;
      ang = null;
      for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
        const a = base + off;
        let ok = true;
        for (let i = 1; i <= n && ok; i++) if (room.probe(this.x + Math.cos(a) * SPACING * i, this.y + Math.sin(a) * SPACING * i, lr, this)) ok = false;
        if (ok) { ang = a; break; }
      }
    }
    const lm = { ...this.meta, hp: LINK_HP, chainLink: true, links: 0 };
    for (let i = 1; i <= n; i++) {
      const d = ang == null ? 0 : SPACING * i;
      const x = this.x + (ang == null ? 0 : Math.cos(ang) * d), y = this.y + (ang == null ? 0 : Math.sin(ang) * d);
      s.fx.spawn(x, y, 0.8);
      new ChainGang(s, x, y, { id: this.id, meta: lm, floor: this.floor, hpMult: opts.hpMult, instant: opts.instant, chain: this.chain, affixes: [] });
    }
    this.chain.rebuild();
  }

  // ------------------------------------------------------------------------------------------ AI
  ai(dt) {
    const c = this.chain;
    if (c.members[0] === this && !this.isHead) this.promote();
    if (this.isHead) this.headAi(dt); else this.followAi(dt);
  }

  followAi(dt) {
    const c = this.chain, head = c.members[0];
    if (!head) { this.stop(); return; }
    c.trail.at(head.x, head.y, SPACING * this.ci, c.pt);
    const dx = c.pt.x - this.x, dy = c.pt.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2 || dt <= 0.0001) { this.stop(); } else {
      const v = Math.min(FOLLOW_MAX, d / dt) / (this.slowBase || 1); // (enemy-speed mutator scales velocities: cancel it so the spacing holds)
      this.vx = (dx / d) * v; this.vy = (dy / d) * v;
    }
    this.setPose('move');
    this.faceToward(this.player.x);
  }

  headAi(dt) {
    const p = this.player;
    switch (this.state) {
      case 'chase': {
        this.setPose('move');
        this.steerToward(p.x, p.y, this.speed * (this.promoted ? PROMOTE_MULT : 1));
        this.faceToward(p.x);
        if (this.promoted) break; // unchained heads never charge
        this.timer -= dt;
        if (this.timer <= 0) { if (this.distToPlayer() >= 130) this.startWind(); else this.timer = 0.4; }
        break;
      }
      case 'wind': {
        this.stop();
        this.wt += dt;
        if (this.wt < LOCK_AT) this.aimAng = this.angleToPlayer();
        this.faceToward(this.x + Math.cos(this.aimAng));
        this.updateAim();
        if (this.wt >= WIND_T) this.startCharge();
        break;
      }
      case 'charge': {
        this.moveAngle(this.aimAng, this.chargeSpeed * (this.speed / (this.meta.speed || 1)));
        this.ct += dt;
        this.dustT -= dt;
        if (this.dustT <= 0) { this.dustT = 0.07; this.scene.fx.dust(this.x, this.y + 16, 0.55); }
        if (this.ct >= CHARGE_T) this.endCharge(false);
        break;
      }
      case 'recover': {
        this.stop();
        this.timer -= dt;
        if (this.timer <= 0) { this.setState('chase'); this.timer = this.cd(CHARGE_CD); }
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------------------------------ charge
  startWind() {
    this.setState('wind');
    this.wt = 0;
    this.aimAng = this.angleToPlayer();
    this.setPose('windup'); // pose 4: ball held overhead
    this.pulse(WIND_T);
    const s = this.scene;
    if (!this.aimBase) {
      this.aimBase = s.add.image(0, 0, 'px').setOrigin(0, 0.5).setTint(0xd63a2a).setAlpha(0.2).setDepth(DEPTH.decals + 6);
      this.aimFill = s.add.image(0, 0, 'px').setOrigin(0, 0.5).setTint(0xd63a2a).setAlpha(0.45).setDepth(DEPTH.decals + 7);
    }
    this.aimBase.setVisible(true); this.aimFill.setVisible(true);
    this.updateAim();
    Sfx.play('chain_rattle', { vol: 0.8 });
  }

  /** Warn line: tracks the player until LOCK_AT, then is locked; the fill grows across the whole windup. */
  updateAim() {
    const len = this.chargeSpeed * (this.speed / (this.meta.speed || 1)) * CHARGE_T + this.radius;
    const k = Math.min(1, this.wt / WIND_T);
    const y = this.y;
    this.aimBase.setPosition(this.x, y).setRotation(this.aimAng).setDisplaySize(len, LINE_W);
    this.aimFill.setPosition(this.x, y).setRotation(this.aimAng).setDisplaySize(len, 4 + (LINE_W - 4) * k * k);
    if (this.wt >= LOCK_AT) this.aimBase.setAlpha(0.3);
  }

  hideAim() { if (this.aimBase) { this.aimBase.setVisible(false); this.aimFill.setVisible(false); } }

  startCharge() {
    this.hideAim();
    this.setState('charge');
    this.ct = 0;
    this.dustT = 0;
    this.setPose('attack'); // pose 5: charge lean
    const fx = this.scene.fx;
    fx.shake(0.005, 120);
    fx.dust(this.x, this.y + 16, 1.2);
    Sfx.play('chain_rattle', { vol: 1, rate: 1.2 });
    Sfx.play('step_dirt', { vol: 0.7, rate: 0.8 });
  }

  /** Charge over (timer) or cut short (wall). `crash` adds a short daze. */
  endCharge(crash) {
    this.stop();
    if (crash) {
      const fx = this.scene.fx;
      fx.shake(0.008, 180);
      fx.dust(this.x, this.y + 14, 1.4);
      fx.burst(this.x, this.y - 20, { color: [0xe8dcc0, 0xc9b98f], count: 8, speed: [100, 260], life: [250, 500], scale: [1.2, 2.2], gravity: 500 });
      Sfx.play('bullet_hit_wall', { vol: 0.8, rate: 0.6 });
      this.setState('recover');
      this.timer = RECOVER_T;
    } else {
      this.setState('chase');
      this.timer = this.cd(CHARGE_CD);
    }
    this.setPose('move');
  }

  onWallHit() { if (this.isHead && this.state === 'charge' && this.ct > 0.1) this.endCharge(true); }

  // ------------------------------------------------------------------------------------------ chain
  /** The next link takes over: unchained (no charges), 30 % faster. */
  promote() {
    this.isHead = true;
    this.promoted = true;
    this.leader = null;
    this.setState('chase');
    if (this.chainImg) { this.chainImg.destroy(); this.chainImg = null; }
    this.refreshTint();
    const fx = this.scene.fx;
    fx.ringPulse(this.x, this.y, 0xff8060, 40, 320, 0.9);
    fx.burst(this.x, this.y - 30, { color: [0xff8060, 0xe8dcc0], count: 8, speed: [80, 220], life: [250, 500], scale: [1.2, 2.4], gravity: 200 });
    Sfx.play('chain_rattle', { vol: 0.9, rate: 0.85 });
    this.pulse(0.3);
  }

  /** Links wear a dull tint; a promoted head glows reddish. */
  refreshTint() {
    super.refreshTint();
    const sp = this.sprite;
    if (!sp || this.flashT > 0 || this.status.stun || this.status.frozen || this.status.burn || this.status.poison || this.status.chill || this.status.fear || this.status.slow || this.wardT > 0) return;
    if (this._affix && this._affix.tint != null) return;
    if (this.promoted) sp.setTint(HEAD_TINT);
    else if (!this.isHead) sp.setTint(LINK_TINTS[(this.ci || 0) % LINK_TINTS.length]);
  }

  syncVisual() {
    super.syncVisual();
    const c = this.chain;
    if (!c) return;
    if (this.isHead) { c.trail.push(this.x, this.y); return; }
    const L = this.leader, img = this.chainImg;
    if (!img) return;
    if (!L || !L.alive || !L.sprite || this.spawnT > 0) { img.setVisible(false); return; }
    const x1 = this.x, y1 = this.footY - this.airHeight - 30, x2 = L.x, y2 = L.footY - L.airHeight - 30;
    const dx = x2 - x1, dy = y2 - y1;
    img.setPosition(x1, y1).setRotation(Math.atan2(dy, dx)).setDisplaySize(Math.hypot(dx, dy), 5).setVisible(true);
    img.setDepth(Math.min(this.sprite.depth, L.sprite.depth) - 0.001);
  }

  onDeath(info) {
    this.hideAim();
    if (!this.isHead || this.promoted) Sfx.play('chain_rattle', { vol: 0.5, rate: 0.7 });
    this.chain.remove(this); // the new front member promotes itself on its next ai tick
  }

  destroy() {
    if (this.chain) this.chain.remove(this);
    if (this.chainImg) { this.chainImg.destroy(); this.chainImg = null; }
    if (this.aimBase) { this.aimBase.destroy(); this.aimFill.destroy(); this.aimBase = this.aimFill = null; }
    super.destroy();
  }
}

registerEnemy('chain_gang', ChainGang, { hp: 12, r: 26, speed: 150, charge: 430, floors: [5], weight: 1.5, tags: ['undead'], links: 3 });
