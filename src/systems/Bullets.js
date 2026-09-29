// Pooled bullet system (custom circle-vs-circle, no arcade bodies). scene.bullets = { player, enemy }
//
// PLAYER:  scene.bullets.player.fire({x,y,angle,speed,damage,life,pierce,ricochet,homing,poison,burn,fear,spectral,size,sixth})
// ENEMY:   scene.bullets.enemy.fire({x,y,angle|vx,vy,speed,damage,kind,radius,life,accel,curve,spectral,onDeath,...})
//          helpers: fan(base,n,spreadDeg), ring(base,n,offsetDeg), spiral(base,{count,stepDeg,interval,startAngle}), aimed(base, tx, ty)
// Bullets are visually lifted by `lift` px above their ground position (x,y is the ground-plane collision centre).
import Phaser from 'phaser';
import { DEPTH, ROOM, TILE, PLAYER, FEEL } from '../config.js';
import { Assets } from '../core/Assets.js';
import { Sfx } from '../core/Audio.js';
import { bus } from '../core/events.js';
import { rad } from '../core/util.js';

const ENEMY_KINDS = {
  enemy: { frame: 'bullet_enemy', r: 12, glow: 0xff5a2a, rotate: false },
  venom: { frame: 'bullet_venom', r: 12, glow: 0x8fc23f, rotate: false },
  nail: { frame: 'bullet_nail', r: 10, glow: 0xffa060, rotate: true },
  ghostfire: { frame: 'bullet_ghostfire', r: 13, glow: 0x6fe0d0, rotate: false },
  rock: { frame: 'rock_debris', r: 16, glow: 0xb09070, rotate: true },
  stick: { frame: 'dynamite_stick', r: 14, glow: 0xff5a2a, rotate: true },
};

class Bullet {
  constructor() { this.active = false; this.hit = null; this.sprite = null; this.shadow = null; this.glow = null; this.streak = null; }
}

class Pool {
  constructor(scene, owner) {
    this.scene = scene;
    this.owner = owner; // 'player' | 'enemy'
    this.isEnemyPool = owner === 'enemy';
    this.list = [];
    this.free = [];
  }

  _get() {
    let b = this.free.pop();
    if (!b) {
      b = new Bullet();
      const s = this.scene;
      b.sprite = Assets.makeCell(s, 0, 0, 'projectiles', 'bullet_player', 0.5).setDepth(DEPTH.bullets);
      b.shadow = s.add.image(0, 0, 'shadow').setDepth(DEPTH.shadows + 1).setScale(0.22).setAlpha(0.7);
      b.glow = s.add.image(0, 0, 'glow').setDepth(DEPTH.bullets - 1).setBlendMode(Phaser.BlendModes.ADD);
      if (this.owner === 'player') b.streak = s.add.image(0, 0, 'fx_streak').setOrigin(1, 0.5).setDepth(DEPTH.bullets - 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    }
    return b;
  }

  /** Fires one bullet; returns the bullet object (live until it dies; do not keep references after `active` is false). */
  fire(o) {
    const b = this._get();
    const isEnemy = this.owner === 'enemy';
    const kind = isEnemy ? ENEMY_KINDS[o.kind || 'enemy'] || ENEMY_KINDS.enemy : null;
    let vx, vy;
    const speed = o.speed ?? (isEnemy ? 300 : 780);
    if (o.vx != null || o.vy != null) { vx = o.vx ?? 0; vy = o.vy ?? 0; } else { vx = Math.cos(o.angle ?? 0) * speed; vy = Math.sin(o.angle ?? 0) * speed; }
    b.active = true;
    b.owner = this.owner;
    b.kind = o.kind || (isEnemy ? 'enemy' : o.sixth ? 'crit' : 'player');
    b.x = o.x; b.y = o.y; b.vx = vx; b.vy = vy;
    b.dmg = o.damage ?? 1;
    b.age = 0;
    b.life = o.life ?? (isEnemy ? 4 : 0.55);
    b.size = o.size ?? 1;
    b.r = (o.radius ?? (isEnemy ? kind.r : 10)) * (isEnemy ? 1 : b.size);
    b.pierce = o.pierce ?? 0;
    b.ricochet = o.ricochet ?? 0;
    b.homing = o.homing ?? 0;
    b.poison = o.poison ?? 0;
    b.burn = o.burn ?? 0;
    b.fear = o.fear ?? 0;
    b.spectral = !!o.spectral;
    b.sixth = !!o.sixth;
    b.mult = o.mult ?? 1;
    b.accel = o.accel ?? 0;
    b.curve = rad(o.curve ?? 0);
    b.onDeath = o.onDeath || null;
    b.onHit = o.onHit || null;
    b.source = o.source || null;
    b.lift = o.lift ?? 30;
    b.rotate = o.rotate ?? (isEnemy ? kind.rotate : true); // player slugs point along their travel
    b.hit = b.pierce > 0 ? new Set() : null;
    b.trailT = 0;
    b.data = o.data || null;
    b.noObstacle = !!o.noObstacle; // ignore obstacles (still dies on walls)
    b.noWall = !!o.noWall; // ignore room walls (dies only on life)
    b.hitsPlayer = o.hitsPlayer ?? true;

    const frameName = isEnemy ? kind.frame : b.sixth ? 'bullet_crit' : 'bullet_player';
    b.sprite.setFrame(Assets.frame('projectiles', frameName));
    b.sprite.setVisible(true).setAlpha(o.alpha ?? 1);
    b.sprite.setScale((o.scale ?? 1) * (isEnemy ? 1 : b.size * FEEL.playerBulletScale * (b.sixth ? 1.25 : 1)));
    b.sprite.setRotation(b.rotate ? Math.atan2(vy, vx) : 0);
    b.sprite.clearTint();
    if (o.tint != null) b.sprite.setTint(o.tint);
    b.shadow.setVisible(true);
    b.glow.setVisible(true);
    const gc = isEnemy ? kind.glow : b.sixth ? 0xffc040 : 0xfff2c0;
    b.glow.setTint(gc).setScale(isEnemy ? 0.55 : (b.sixth ? 0.85 : 0.5) * Math.min(1.6, b.size)).setAlpha(isEnemy ? 0.65 : b.sixth ? 0.55 : 0.4);
    if (!isEnemy) {
      // brass streak behind the slug (gold + longer for the Sixth Bullet); tinted per shot below via b.glow tint
      const len = Math.max(18, Math.hypot(vx, vy) * FEEL.streakLen * (b.sixth ? 1.7 : 1));
      b.streak.setVisible(true).setTint(gc).setAlpha(b.sixth ? 0.7 : 0.42).setDisplaySize(len, (b.sixth ? 11 : 7) * Math.min(1.6, b.size));
    }
    this._place(b);
    this.list.push(b);
    if (bus.listenerCount('bullet:fired') > 0) bus.emit('bullet:fired', { bullet: b, sixth: b.sixth, owner: this.owner }); // skip the per-shot allocation when nobody listens
    return b;
  }

  _place(b) {
    const y = b.y - b.lift;
    b.sprite.setPosition(b.x, y);
    b.glow.setPosition(b.x, y);
    if (!this.isEnemyPool) { b.streak.setPosition(b.x, y); b.streak.setRotation(Math.atan2(b.vy, b.vx)); }
    b.shadow.setPosition(b.x, b.y + 6);
  }

  kill(b, reason = 'life', silent = false) {
    if (!b.active) return;
    b.active = false;
    b.sprite.setVisible(false);
    b.shadow.setVisible(false);
    b.glow.setVisible(false);
    if (b.streak) b.streak.setVisible(false);
    const s = this.scene;
    if (!silent && (reason === 'wall' || reason === 'obstacle' || reason === 'hit' || reason === 'life')) {
      const ang = Math.atan2(b.vy, b.vx);
      if (reason !== 'life' || this.owner === 'player') s.fx.impact(b.x, b.y - b.lift, ang, this.owner === 'enemy' ? 0.8 : b.sixth ? 1.3 : 0.9);
      if (reason === 'wall' || reason === 'obstacle') Sfx.play('bullet_hit_wall', { vol: 0.6, detune: (Math.random() - 0.5) * 300 });
    }
    // reason 'clear' = silent teardown (room change / boss death): never run callbacks that could spawn things.
    // NOTE: the bullet stays in `list` (inactive) until the end-of-frame compaction returns it to `free`; recycling it
    // immediately would let fire() (e.g. from an onDeath callback) re-activate a stale list slot -> the bullet would be updated twice.
    if (b.onDeath && reason !== 'clear') { try { b.onDeath(b, reason); } catch (e) { console.error(e); } }
    b.onDeath = null; b.onHit = null; b.source = null; b.data = null;
  }

  clear() {
    for (const b of this.list) { this.kill(b, 'clear', true); this.free.push(b); }
    this.list.length = 0;
  }

  /** Kill enemy bullets within radius of a point (silent). */
  clearRadius(x, y, r) {
    for (const b of this.list) if (b.active && Math.hypot(b.x - x, b.y - y) < r) this.kill(b, 'clear', true);
  }

  update(dt) {
    const s = this.scene;
    const room = s.room;
    const list = this.list;
    const isEnemy = this.owner === 'enemy';
    const player = s.player;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.active) continue;
      // steering
      if (b.accel) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const ns = Math.max(0, sp + b.accel * dt);
        b.vx *= ns / sp; b.vy *= ns / sp;
      }
      if (b.curve) {
        const c = Math.cos(b.curve * dt), sn = Math.sin(b.curve * dt);
        const nx = b.vx * c - b.vy * sn;
        b.vy = b.vx * sn + b.vy * c; b.vx = nx;
      }
      if (b.homing > 0 && !isEnemy) this._home(b, dt);
      if (b.homing > 0 && isEnemy && player) this._homeTo(b, player.x, player.y, b.homing, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.age += dt;
      if (b.rotate) b.sprite.setRotation(Math.atan2(b.vy, b.vx));
      if (b.sixth && b.age - b.trailT > 0.03) { b.trailT = b.age; s.fx.burst(b.x, b.y - b.lift, { color: [0xffb030, 0xffe090], count: 1, speed: [0, 30], life: [180, 340], scale: [1, 3.6], blend: 'ADD' }); }
      if (b.age >= b.life) { this.kill(b, 'life'); continue; }

      // room bounds
      if (!b.noWall) {
        let bounced = false;
        if (b.x - b.r < ROOM.x) { b.x = ROOM.x + b.r; if (b.ricochet > 0) { b.vx = Math.abs(b.vx); bounced = true; } else { this.kill(b, 'wall'); continue; } }
        else if (b.x + b.r > ROOM.right) { b.x = ROOM.right - b.r; if (b.ricochet > 0) { b.vx = -Math.abs(b.vx); bounced = true; } else { this.kill(b, 'wall'); continue; } }
        if (b.y - b.r < ROOM.y) { b.y = ROOM.y + b.r; if (b.ricochet > 0) { b.vy = Math.abs(b.vy); bounced = true; } else { this.kill(b, 'wall'); continue; } }
        else if (b.y + b.r > ROOM.bottom) { b.y = ROOM.bottom - b.r; if (b.ricochet > 0) { b.vy = -Math.abs(b.vy); bounced = true; } else { this.kill(b, 'wall'); continue; } }
        if (bounced) { b.ricochet--; b.sprite.setRotation(b.rotate ? Math.atan2(b.vy, b.vx) : 0); s.fx.impact(b.x, b.y - b.lift, 0, 0.6); Sfx.play('bullet_hit_wall', { vol: 0.4 }); }
      }

      // obstacles
      if (room && !b.spectral && !b.noObstacle) {
        const tile = room.bulletBlock(b.x, b.y, b.r * 0.8);
        if (tile) {
          if (!isEnemy && tile.type === 'breakable') room.damageTile(tile, 1, b);
          if (b.ricochet > 0 && tile.type !== 'breakable') {
            this._reflectTile(b, tile);
            b.ricochet--;
          } else { this.kill(b, 'obstacle'); continue; }
        }
      }

      if (isEnemy) {
        // familiars / shields that block bullets
        let blocked = false;
        for (const f of player ? player.familiars : []) {
          if (f.blocksBullets && Math.hypot(f.x - b.x, f.y - b.y) < (f.radius || 30) + b.r) { blocked = true; if (f.onBlock) f.onBlock(b); break; }
        }
        if (blocked) { this.kill(b, 'hit'); continue; }
        if (player && b.hitsPlayer && player.canBeHit()) {
          const rr = player.hurtRadius + b.r * 0.6;
          if ((player.x - b.x) ** 2 + (player.y - b.y) ** 2 < rr * rr) {
            player.damage(b.dmg, { x: b.x, y: b.y, bullet: b, kind: b.kind });
            this.kill(b, 'hit');
            continue;
          }
        }
      } else {
        // player bullets vs enemies
        const enemies = s.enemies;
        let dead = false;
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (!e.alive || !e.targetable) continue;
          if (b.hit && b.hit.has(e)) continue;
          const rr = e.hitRadius + b.r;
          if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) continue;
          const res = e.takeHit(b.dmg * b.mult, { x: b.x, y: b.y, angle: Math.atan2(b.vy, b.vx), bullet: b, sixth: b.sixth, poison: b.poison, burn: b.burn, fear: b.fear, knock: b.sixth ? 1.6 : 1 });
          if (res === 'ignore') continue;
          if (b.onHit) b.onHit(b, e);
          if (b.pierce > 0) { b.pierce--; b.hit.add(e); } else { dead = true; }
          break;
        }
        if (dead) { this.kill(b, 'hit'); continue; }
      }
      this._place(b);
    }
    // compact
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.active) list[w++] = b; else this.free.push(b);
    }
    list.length = w;
  }

  _home(b, dt) {
    const enemies = this.scene.enemies;
    let best = null, bd = 520 * 520;
    const ang = Math.atan2(b.vy, b.vx);
    for (const e of enemies) {
      if (!e.alive || !e.targetable) continue;
      const dx = e.x - b.x, dy = e.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > bd) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang)) > 1.3) continue;
      bd = d2; best = e;
    }
    if (best) this._homeTo(b, best.x, best.y, b.homing, dt);
  }
  _homeTo(b, tx, ty, strength, dt) {
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const cur = Math.atan2(b.vy, b.vx);
    const want = Math.atan2(ty - b.y, tx - b.x);
    const d = Phaser.Math.Angle.Wrap(want - cur);
    const step = Math.max(-1, Math.min(1, d / 0.3)) * strength * 6 * dt;
    const na = cur + Math.max(-Math.abs(d), Math.min(Math.abs(d), step));
    b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
  }
  _reflectTile(b, tile) {
    const rx = ROOM.x + tile.c * TILE, ry = ROOM.y + tile.r * TILE;
    const qx = Phaser.Math.Clamp(b.x, rx, rx + TILE), qy = Phaser.Math.Clamp(b.y, ry, ry + TILE);
    let nx = b.x - qx, ny = b.y - qy;
    const d = Math.hypot(nx, ny);
    if (d < 0.001) { nx = b.vx > 0 ? -1 : 1; ny = 0; } else { nx /= d; ny /= d; }
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
    b.x = qx + nx * (b.r + 2); b.y = qy + ny * (b.r + 2);
  }

  // --------------------------------------------------------------------- enemy pattern helpers
  /** n bullets fanned around base.angle (or toward base.tx,ty), total spread in degrees. */
  fan(base, n, spreadDeg, angle) {
    const a0 = angle ?? base.angle ?? 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * rad(spreadDeg);
      out.push(this.fire({ ...base, angle: a0 + off, vx: undefined, vy: undefined }));
    }
    return out;
  }
  /** n bullets evenly around a circle. */
  ring(base, n, offsetDeg = 0) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.fire({ ...base, angle: rad(offsetDeg) + (i / n) * Math.PI * 2, vx: undefined, vy: undefined }));
    return out;
  }
  /** Bullet aimed at a point. */
  aimed(base, tx, ty, extraDeg = 0) {
    return this.fire({ ...base, angle: Math.atan2(ty - base.y, tx - base.x) + rad(extraDeg), vx: undefined, vy: undefined });
  }
  /** Timed spiral: fires `count` bullets, one every `interval` s, rotating by stepDeg. Returns {cancel()}. */
  spiral(base, { count = 16, stepDeg = 22, interval = 0.08, startAngle = 0, arms = 1 } = {}) {
    let i = 0;
    const ev = this.scene.time.addEvent({
      delay: interval * 1000, repeat: count - 1,
      callback: () => {
        for (let k = 0; k < arms; k++) this.fire({ ...base, x: base.getX ? base.getX() : base.x, y: base.getY ? base.getY() : base.y, angle: rad(startAngle + i * stepDeg) + (k / arms) * Math.PI * 2, vx: undefined, vy: undefined });
        i++;
      },
    });
    return { cancel: () => ev.remove() };
  }
}

export default class Bullets {
  constructor(scene) {
    this.scene = scene;
    this.player = new Pool(scene, 'player');
    this.enemy = new Pool(scene, 'enemy');
  }
  update(dt) {
    this.player.update(dt);
    this.enemy.update(dt);
  }
  clear() { this.player.clear(); this.enemy.clear(); }
  get count() { return this.player.list.length + this.enemy.list.length; }
}
