// Juice / visual effects. One instance per GameScene: scene.fx
import Phaser from 'phaser';
import { DEPTH, ROOM, FONT_BODY, FEEL } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Save } from '../core/Save.js';
import { bus } from '../core/events.js';
import { Sfx } from '../core/Audio.js';

export default class Fx {
  constructor(scene) {
    this.scene = scene;
    this.active = new Set(); // transient display objects (destroyed on room change)
    this.motes = null;
    this.hitStopUntil = 0;
    this.pool = new Map(); // fx sprite pool: key -> [hidden sprites]
    this.emitters = new Map(); // burst emitter cache: config signature -> ParticleEmitter
    this.casings = []; // pooled shell casings (manual ballistic sprites)
    this.arcs = []; // pooled lightning arcs (Graphics)
    this.nums = []; // pooled damage numbers (settings.dmgNumbers)
    this._mkStreak();
  }

  /** Soft horizontal gradient (transparent tail -> bright head) used for bullet streaks. */
  _mkStreak() {
    const t = this.scene.textures;
    if (t.exists('fx_streak')) return;
    const c = t.createCanvas('fx_streak', 64, 8);
    const ctx = c.getContext();
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(60, 0.5); ctx.lineTo(64, 4); ctx.lineTo(60, 7.5); ctx.closePath(); ctx.fill();
    c.refresh();
    // scorch mark: irregular soot blotch with radial streaks (explosion decal)
    if (!t.exists('fx_scorch')) {
      const sc = t.createCanvas('fx_scorch', 192, 192), x = sc.getContext();
      const g2 = x.createRadialGradient(96, 96, 4, 96, 96, 92);
      g2.addColorStop(0, 'rgba(8,4,2,0.95)'); g2.addColorStop(0.5, 'rgba(12,7,4,0.6)'); g2.addColorStop(1, 'rgba(12,7,4,0)');
      x.fillStyle = g2; x.beginPath();
      for (let i = 0; i <= 28; i++) { const an = (i / 28) * Math.PI * 2, r = 64 + ((i * 7919) % 13) * 2.2; x[i ? 'lineTo' : 'moveTo'](96 + Math.cos(an) * r, 96 + Math.sin(an) * r); }
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(10,6,3,0.5)'; x.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const an = (i * 2.399) % 6.283, r0 = 30, r1 = 55 + ((i * 37) % 40); x.lineWidth = 3 + (i % 3) * 2; x.beginPath(); x.moveTo(96 + Math.cos(an) * r0, 96 + Math.sin(an) * r0); x.lineTo(96 + Math.cos(an) * r1, 96 + Math.sin(an) * r1); x.stroke(); }
      sc.refresh();
    }
  }

  _track(obj) {
    this.active.add(obj);
    obj.once('destroy', () => this.active.delete(obj));
    return obj;
  }

  /** Play a one-shot animated fx strip at (x,y). Sprites are pooled per key (impacts/dust/muzzle flashes fire constantly). Returns the sprite. */
  play(key, x, y, o = {}) {
    const s = this.scene;
    const anim = Assets.ensureAnim(s, key, { fps: o.fps ?? 20, repeat: 0, name: 'once' });
    const pool = this.pool.get(key) || (this.pool.set(key, []), this.pool.get(key));
    let spr = pool.pop();
    if (spr && spr.scene) {
      spr.setActive(true).setVisible(true).setPosition(x, y);
      spr.clearTint();
      spr.setAlpha(1).setScale(1).setRotation(0).setFlipX(false).setBlendMode(Phaser.BlendModes.NORMAL);
      spr.setOrigin(0.5, Assets.anchor(key) === 'bottom' ? 1 : 0.5);
      this.active.add(spr);
    } else {
      spr = Assets.makeSprite(s, x, y, key, 0);
      this._track(spr);
    }
    spr.setDepth(o.depth ?? DEPTH.fx);
    if (o.origin) spr.setOrigin(o.origin[0], o.origin[1]);
    if (o.scale != null) spr.setScale(o.scale);
    if (o.rotation) spr.setRotation(o.rotation);
    if (o.tint != null) spr.setTint(o.tint);
    if (o.alpha != null) spr.setAlpha(o.alpha);
    if (o.blend) spr.setBlendMode(o.blend);
    if (o.flipX) spr.setFlipX(true);
    spr.once('animationcomplete', () => {
      if (o.onDone) o.onDone();
      this.active.delete(spr);
      if (pool.length < 24) { spr.setVisible(false).setActive(false); pool.push(spr); } else spr.destroy();
    });
    spr.play(anim);
    return spr;
  }

  explosion(x, y, radius = 150) {
    const scale = (radius * 2.1) / 192;
    this.play('fx_explosion', x, y - 20, { scale, fps: 18, depth: DEPTH.fx + 1 });
    this.burst(x, y, { color: [0xffc040, 0xd63a2a, 0x6b4423], count: 26, speed: [140, 460], scale: [1.2, 3], life: [300, 700], gravity: 0 });
    this.burst(x, y, { color: [0xffe090, 0xffa030], count: 14, speed: [200, 560], life: [250, 600], scale: [1, 2.4], gravity: 260, blend: 'ADD' }); // embers
    this.dustRing(x, y + 8, radius);
    this.decal(x, y, 'scorch', radius / 130);
    const k = Math.min(1.6, Math.max(0.5, radius / 150)); // big blasts (bosses, kegs) kick harder, small chain blasts stay light
    this.shake(0.014 * k, 320);
    if (radius >= 100) this.flash(0xffe0a0, 0.16 * Math.min(1.4, k));
  }
  /** Expanding dust shockwave on the floor + radial dust puffs (explosions, slams, room clear). */
  dustRing(x, y, radius = 150, color = 0xb89868) {
    const s = this.scene;
    const ring = s.add.image(x, y, 'ring').setTint(color).setAlpha(0.55).setDepth(DEPTH.decals + 8).setScale((radius * 0.5) / 64, (radius * 0.35) / 64);
    this._track(ring);
    s.tweens.add({ targets: ring, scaleX: (radius * 2.1) / 128, scaleY: (radius * 1.45) / 128, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const q = Math.max(1, Math.round(radius / 40)) * 40; // quantised: emitters are cached per configuration
    this.burst(x, y, { color: [color, 0x8a7458], count: Math.min(18, 8 + Math.round(radius / 30)), speed: [q * 1.2, q * 3.2], life: [350, 650], scale: [0.12, 0.42], tex: 'glow', alpha: [0.5, 0], depth: DEPTH.decals + 9 });
  }
  /** Soft ring pulse (cooldown ready, room clear, pickups...). */
  ringPulse(x, y, color = 0xf0a640, radius = 40, ms = 340, alpha = 0.7) {
    const s = this.scene;
    const r = s.add.image(x, y, 'ring').setTint(color).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx - 2).setScale(radius * 0.4 / 64);
    this._track(r);
    s.tweens.add({ targets: r, scale: (radius * 2) / 128, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
    return r;
  }
  /** Tiny grey gun-smoke puff drifting up from the muzzle. */
  smoke(x, y, n = 2, big = false) {
    this.burst(x, y, { color: [0xc8c0b0, 0x9a927f], count: n, speed: [8, big ? 55 : 32], life: [380, big ? 800 : 620], scale: big ? [0.1, 0.34] : [0.07, 0.24], tex: 'glow', alpha: [big ? 0.42 : 0.3, 0], gravity: -40 });
  }
  /** Directional hit sparks (bright, additive) sprayed back along -angle; `gold` for the Sixth Bullet. */
  spark(x, y, angle, gold = false) {
    const back = angle + Math.PI;
    this.burst(x, y, { color: gold ? [0xffe090, 0xffc040, 0xffffff] : [0xfff2c0, 0xffc060], count: gold ? 9 : 5, speed: [140, gold ? 460 : 340], life: [110, gold ? 300 : 220], scale: [1, gold ? 3 : 2.2], blend: 'ADD', dir: back, spread: gold ? 70 : 55 });
  }
  /** Ejected brass shell: arcs to the floor, bounces once, rests, fades. (ax,ay) = aim unit vector. */
  casing(x, y, ax, ay) {
    if (!FEEL.casings) return;
    const s = this.scene;
    let c = null;
    for (const k of this.casings) if (!k.on) { c = k; break; }
    if (!c) {
      if (this.casings.length >= 24) return;
      c = { img: s.add.image(0, 0, 'px').setDisplaySize(7, 3.5).setTint(0xdcae4a), on: false };
      this.casings.push(c);
    }
    if (!c.img.scene) return;
    const side = Math.random() < 0.85 ? 1 : -1; // ejects to the gun-hand side
    const px = -ay * side, py = ax * side;
    const sp = 90 + Math.random() * 90;
    c.on = true; c.gx = x; c.gy = y; c.z = 30; c.vz = 190 + Math.random() * 110;
    c.vx = px * sp - ax * 30; c.vy = py * sp * 0.6 - ay * 30 - 10;
    c.rot = Math.random() * 6.28; c.vr = (Math.random() - 0.5) * 30; c.t = 0; c.bounced = false; c.rest = 0;
    c.img.setVisible(true).setActive(true).setAlpha(1).setDepth(DEPTH.bullets - 2).setPosition(x, y - 30).setRotation(c.rot);
  }
  updateCasings(dt) {
    for (const c of this.casings) {
      if (!c.on) continue;
      if (c.z > 0 || c.vz > 0) {
        c.vz -= 1200 * dt; c.z += c.vz * dt; c.gx += c.vx * dt; c.gy += c.vy * dt; c.rot += c.vr * dt;
        if (c.z <= 0) {
          c.z = 0;
          if (!c.bounced) { c.bounced = true; c.vz = -c.vz * 0.35; c.vx *= 0.5; c.vy *= 0.5; c.vr *= 0.4; } else { c.vz = 0; c.vx = c.vy = c.vr = 0; c.img.setDepth(DEPTH.decals + 2); }
        }
      } else {
        c.rest += dt;
        if (c.rest > 0.9) { c.img.setAlpha(Math.max(0, 1 - (c.rest - 0.9) / 0.5)); if (c.rest > 1.4) { c.on = false; c.img.setVisible(false).setActive(false); continue; } }
      }
      c.img.setPosition(c.gx, c.gy - c.z).setRotation(c.rot);
    }
  }
  /** Fading copy of a sprite (dodge-roll afterimages). */
  afterimage(spr, tint = 0xffffff, alpha = 0.4, ms = 220) {
    if (!spr || !spr.scene) return;
    const s = this.scene;
    const im = s.add.image(spr.x, spr.y, spr.texture.key, spr.frame.name).setOrigin(spr.originX, spr.originY).setScale(spr.scaleX, spr.scaleY).setRotation(spr.rotation).setFlipX(spr.flipX)
      .setTintFill(tint).setAlpha(alpha).setDepth(spr.depth - 0.5);
    this._track(im);
    s.tweens.add({ targets: im, alpha: 0, duration: ms, onComplete: () => im.destroy() });
  }
  /** Per-frame simulation-time update (called from GameScene.update, so it respects hit-stop and slow-mo). */
  update(dt) { this.updateCasings(dt); this._updateArcs(dt); this._updateNums(dt); }

  /** Code-drawn jagged lightning line (ITEMS 2.3 chain). Pooled Graphics, fades over `ms`. */
  arc(x1, y1, x2, y2, o = {}) {
    Sfx.play('shock_zap', { vol: 0.6 }); // lightning rod / roulette / scratch arcs (mix.js rate-limits it)
    let a = null;
    for (let i = 0; i < this.arcs.length; i++) if (!this.arcs[i].on && this.arcs[i].g.scene) { a = this.arcs[i]; break; }
    if (!a) {
      if (this.arcs.length >= 24) return;
      a = { g: this.scene.add.graphics().setDepth(DEPTH.fx + 3).setBlendMode(Phaser.BlendModes.ADD), on: false, t: 0, ms: 120 };
      a.g.__noSnap = true;
      this.arcs.push(a);
    }
    const color = o.color ?? 0xfff2a0;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(2, Math.min(9, Math.round(len / 34)));
    const px = -dy / len, py = dx / len;
    const g = a.g;
    g.clear().setVisible(true).setAlpha(1);
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(pass ? 2 : 6, pass ? 0xffffff : color, pass ? 1 : 0.45);
      g.beginPath(); g.moveTo(x1, y1);
      for (let i = 1; i < n; i++) {
        const k = i / n, j = (Math.random() - 0.5) * 26;
        g.lineTo(x1 + dx * k + px * j, y1 + dy * k + py * j);
      }
      g.lineTo(x2, y2); g.strokePath();
    }
    a.on = true; a.t = 0; a.ms = o.ms ?? 120;
  }
  _updateArcs(dt) {
    for (let i = 0; i < this.arcs.length; i++) {
      const a = this.arcs[i];
      if (!a.on) continue;
      a.t += dt * 1000;
      if (a.t >= a.ms) { a.on = false; a.g.clear().setVisible(false); } else a.g.setAlpha(1 - a.t / a.ms);
    }
  }
  /** Depth to draw a gameplay cue at: lifted above the LightMask (196) while the room is a darkness room (`room.darkMask`), otherwise unchanged. */
  lit(depth) { const r = this.scene.room; return r && r.darkMask && depth < DEPTH.bullets + 2 ? DEPTH.bullets + 2 : depth; }
  /** Damage number (settings.dmgNumbers, off by default). Pooled Text objects, simulation-time drift; o: {crit, color, heal}. */
  damageNumber(x, y, amount, o = {}) {
    if (!Save.settings().dmgNumbers) return null;
    let n = null;
    for (let i = 0; i < this.nums.length; i++) if (!this.nums[i].on && this.nums[i].t.scene) { n = this.nums[i]; break; }
    if (!n) {
      if (this.nums.length >= 24) return null;
      const t = this.scene.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '20px', color: '#e8dcc0', stroke: '#120c0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fx + 21);
      t.__noSnap = true;
      n = { t, on: false, age: 0, life: 0.7, x: 0, y: 0, dx: 0 };
      this.nums.push(n);
    }
    const v = Math.round(amount * 10) / 10;
    n.t.setText(o.heal ? `+${v}` : `${v}`).setColor(o.color ?? (o.crit ? '#ffc040' : o.heal ? '#8fe08f' : '#f0e8d8')).setFontSize(o.crit ? 28 : 20).setAlpha(1).setVisible(true).setPosition(x, y);
    n.on = true; n.age = 0; n.x = x; n.y = y; n.dx = ((this.nums.length * 37 + (v * 13)) % 21 - 10) * 1.4;
    return n.t;
  }
  _updateNums(dt) {
    for (let i = 0; i < this.nums.length; i++) {
      const n = this.nums[i];
      if (!n.on) continue;
      n.age += dt;
      if (n.age >= n.life) { n.on = false; n.t.setVisible(false); continue; }
      const k = n.age / n.life;
      n.t.setPosition(n.x + n.dx * n.age, n.y - 46 * (1 - (1 - k) * (1 - k))).setAlpha(k < 0.5 ? 1 : 2 - 2 * k);
    }
  }
  impact(x, y, angle = 0, scale = 1) { return this.play('fx_impact', x, y, { scale: 0.9 * scale, rotation: angle, fps: 26, depth: DEPTH.fx }); }
  muzzle(x, y, angle, scale = 1) { return this.play('fx_muzzle', x, y, { origin: [0, 0.5], rotation: angle, scale: 0.75 * scale, fps: 30 }); }
  deathPuff(x, y, scale = 1) { return this.play('fx_death_puff', x, y - 20, { scale, fps: 14 }); }
  dust(x, y, scale = 0.8) { return this.play('fx_dust', x, y, { scale, fps: 14, alpha: 0.85, depth: DEPTH.shadows + 2 }); }
  spawn(x, y, scale = 1) { return this.play('fx_spawn', x, y, { scale, fps: 9, depth: DEPTH.decals + 5 }); }

  /** Persistent decal on the room floor (stored in room state so it survives leaving the room). */
  decal(x, y, kind = 'blood', scale = 1, save = true) {
    const s = this.scene;
    const room = s.room;
    let frame = 0;
    if (kind === 'blood') frame = Math.floor(Math.random() * 4);
    const d = { x, y, kind, frame, scale: scale * (0.7 + Math.random() * 0.5), rot: Math.random() * 6.28 };
    if (room) room.addDecal(d, save);
    return d;
  }

  /** Floating text (damage pops, "+1", price labels). */
  text(x, y, str, o = {}) {
    const t = this.scene.add.text(x, y, str, {
      fontFamily: FONT_BODY, fontSize: `${o.size ?? 26}px`, color: o.color ?? '#e8dcc0', stroke: '#120c0a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTH.fx + 20);
    this._track(t);
    this.scene.tweens.add({ targets: t, y: y - (o.rise ?? 50), alpha: { from: 1, to: 0 }, duration: o.time ?? 900, ease: 'Cubic.easeOut', delay: o.delay ?? 0, onComplete: () => t.destroy() });
    return t;
  }

  /** Particle burst using the shared 'px' texture. o: {color:[hex...], count, speed:[min,max], life:[min,max], scale:[a,b], gravity, angle:[min,max] deg}
   *  Emitters are cached per configuration and re-fired with explode(): creating a ParticleEmitter game object per burst is expensive. */
  burst(x, y, o = {}) {
    const s = this.scene;
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? 0xffffff];
    const tex = o.tex || 'px';
    const sig = `${tex}|${colors.join(',')}|${o.speed || ''}|${o.life || ''}|${o.scale || ''}|${o.gravity ?? 0}|${o.angle || ''}|${o.blend || ''}|${o.depth ?? ''}|${o.alpha || ''}|${o.dir != null ? 'd' : ''}`;
    let em = this.emitters.get(sig);
    if (!em || !em.scene) {
      const grow = tex !== 'px' && o.scale; // soft textured puffs (tex:'glow') grow from scale[0] to scale[1] and fade; px sparks shrink from scale[1] to 0
      em = s.add.particles(0, 0, tex, {
        speed: { min: o.speed?.[0] ?? 80, max: o.speed?.[1] ?? 240 },
        lifespan: { min: o.life?.[0] ?? 250, max: o.life?.[1] ?? 550 },
        scale: grow ? { start: o.scale[0], end: o.scale[1] } : { start: o.scale?.[1] ?? 2, end: 0 },
        alpha: o.alpha ? { start: o.alpha[0], end: o.alpha[1] } : 1,
        angle: o.angle ? { min: o.angle[0], max: o.angle[1] } : { min: 0, max: 360 },
        tint: colors,
        gravityY: o.gravity ?? 0,
        emitting: false,
        blendMode: o.blend ?? 'NORMAL',
      });
      em.setDepth(o.depth ?? DEPTH.fx);
      em.__noSnap = true;
      if (this.emitters.size < 48) this.emitters.set(sig, em);
      else { this._track(em); s.time.delayedCall((o.life?.[1] ?? 550) + 100, () => em.destroy()); }
    }
    if (o.dir != null) { const d = (o.dir * 180) / Math.PI, sp = o.spread ?? 40; em.setEmitterAngle({ min: d - sp, max: d + sp }); }
    em.explode(o.count ?? 12, x, y);
    return em;
  }

  /** Bullet trail dot. */
  trail(x, y, color = 0xffc040, size = 0.5) {
    const g = this.scene.add.image(x, y, 'glow').setTint(color).setScale(size).setAlpha(0.7).setDepth(DEPTH.bullets - 1).setBlendMode(Phaser.BlendModes.ADD);
    this._track(g);
    this.scene.tweens.add({ targets: g, alpha: 0, scale: size * 0.3, duration: 220, onComplete: () => g.destroy() });
  }

  /** Expanding warning ring on the floor (boss/enemy telegraph). Returns a handle {destroy()}. */
  warnCircle(x, y, radius, time = 0.8, color = 0xd63a2a) {
    const s = this.scene;
    const disc = s.add.image(x, y, 'disc').setTint(color).setAlpha(0.18).setDepth(DEPTH.decals + 6).setDisplaySize(radius * 2, radius * 2);
    const ring = s.add.image(x, y, 'ring').setTint(color).setAlpha(0.8).setDepth(DEPTH.decals + 7).setDisplaySize(radius * 2, radius * 2);
    const fill = s.add.image(x, y, 'disc').setTint(color).setAlpha(0.35).setDepth(DEPTH.decals + 6).setDisplaySize(4, 4);
    [disc, ring, fill].forEach((o) => this._track(o));
    s.tweens.add({ targets: fill, displayWidth: radius * 2, displayHeight: radius * 2, duration: time * 1000, ease: 'Quad.easeIn' });
    const done = () => { [disc, ring, fill].forEach((o) => o.destroy()); };
    const t = s.time.delayedCall(time * 1000, done);
    return { destroy() { t.remove(); done(); } };
  }
  /** Warning line (from x1,y1 to x2,y2) that fills in over `time`. */
  warnLine(x1, y1, x2, y2, width = 40, time = 0.6, color = 0xd63a2a) {
    const s = this.scene;
    const len = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const ang = Phaser.Math.Angle.Between(x1, y1, x2, y2);
    const base = s.add.image(x1, y1, 'px').setOrigin(0, 0.5).setTint(color).setAlpha(0.2).setRotation(ang).setDisplaySize(len, width).setDepth(DEPTH.decals + 6);
    const fill = s.add.image(x1, y1, 'px').setOrigin(0, 0.5).setTint(color).setAlpha(0.45).setRotation(ang).setDisplaySize(len, 2).setDepth(DEPTH.decals + 7);
    [base, fill].forEach((o) => this._track(o));
    s.tweens.add({ targets: fill, displayHeight: width, duration: time * 1000, ease: 'Quad.easeIn' });
    const done = () => { base.destroy(); fill.destroy(); };
    const t = s.time.delayedCall(time * 1000, done);
    return { destroy() { t.remove(); done(); } };
  }

  /** Camera shake scaled by settings.shakeAmt (0 = off; the legacy `shake:false` boolean also disables it). */
  shake(intensity = 0.006, ms = 150) {
    const st = Save.settings();
    if (st.shake === false) return;
    const k = st.shakeAmt == null ? 1 : Math.max(0, Math.min(1, st.shakeAmt));
    if (k <= 0) return;
    this.scene.cameras.main.shake(ms, intensity * k);
  }
  /** Freeze the simulation briefly (impact feel). */
  hitStop(ms = 40) {
    this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + ms);
  }
  get frozen() { return performance.now() < this.hitStopUntil; }
  /** Screen flash (HUD vignette); honours settings.flash. Prefer this over emitting 'hud:flash' directly. */
  flash(color = 0xd63a2a, alpha = 0.5) { if (Save.settings().flash === false) return; bus.emit('hud:flash', { color, alpha }); }

  /** Ambient floating dust motes over the room. */
  startMotes() {
    if (this.motes) return;
    const s = this.scene;
    this.motes = s.add.particles(0, 0, 'glow', {
      x: { min: ROOM.x, max: ROOM.right },
      y: { min: ROOM.y, max: ROOM.bottom },
      lifespan: { min: 4000, max: 8000 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -12, max: 6 },
      scale: { min: 0.03, max: 0.09 },
      alpha: { values: [0, 0.35, 0] },
      frequency: 260,
      tint: 0xe8dcc0,
      quantity: 1,
    }).setDepth(DEPTH.fx - 5);
    this.motes.setBlendMode(Phaser.BlendModes.ADD);
    this.motes.__noSnap = true;
  }
  setMotesVisible(v) { if (this.motes) this.motes.setVisible(v); }

  /** Destroy every transient fx object (room change). */
  clear() {
    for (const o of [...this.active]) { try { o.destroy(); } catch (e) { /* */ } }
    this.active.clear();
    for (const list of this.pool.values()) { for (let i = list.length - 1; i >= 0; i--) if (!list[i].scene) list.splice(i, 1); }
    for (const em of this.emitters.values()) { try { em.killAll(); } catch (e) { /* */ } }
    for (const c of this.casings) if (c.on) { c.on = false; if (c.img.scene) c.img.setVisible(false).setActive(false); }
    for (const a of this.arcs) if (a.on) { a.on = false; if (a.g.scene) a.g.clear().setVisible(false); }
    for (const n of this.nums) if (n.on) { n.on = false; if (n.t.scene) n.t.setVisible(false); }
  }
}
