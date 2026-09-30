// The Dead Man's Duel (EVENTS 3.7): a ghost duelist waits beside the duel post, invulnerable. Stand on the chalk mark (0.6 s hold, ACCEPT THE DUEL):
// doors lock, the bell tolls at 0.9 / 1.9 / 2.9 s, then DRAW! at 3.4 s + 0..1.2 s (seeded from the room seed). The ghost then fights (see types/duelist.js).
// Reward on the duelist's death: a free wooden chest at the room centre, plus a treasure pedestal when the duel was flawless (run.flawlessDuel).
// Persistent (state.data): { phase: 'idle' | 'duel' | 'done', flawless }. A duel torn down mid-way (debug jump / death) returns to 'idle'.
import { EventBase, ROOM, DEPTH, tileToWorld, actorDepth } from './common.js';
import { DUEL, drawDelay } from './tables.js';
import { Sfx } from '../../../core/Audio.js';
import { bus } from '../../../core/events.js';
import { subRng } from '../../../core/rng.js';
import { spawnEnemy } from '../../../enemies/index.js';

const TILE = 96;

export default class QuickDraw extends EventBase {
  build() {
    const { scene } = this;
    const d = this.data;
    d.phase = d.phase || 'idle';
    if (d.phase === 'duel') d.phase = 'idle';
    this.t = -1; // duel clock, < 0 = not running
    this.bells = 0;
    this.drawn = false;
    this.hurt = false;
    this.duelist = null;
    const chalk = this.spots('I', [[2, 3]])[0];
    const post = this.spots('K', [[10, 2]])[0];
    this.post = post;
    this.foePos = { x: post.x, y: post.y + TILE };
    this.chalkAt = chalk;
    if (d.phase === 'done') { this.finish(d.outcome || 'won'); return; }
    this.drawChalk(chalk);
    this.label(chalk.x, chalk.y + 70, 'CHALK MARK', { size: 18, color: '#d8d0c0' });
    this.mark = this.ring({
      x: chalk.x, y: chalk.y, r: 62, hold: 0.6, color: 0xe8e0d0, label: 'ACCEPT THE DUEL',
      canUse: () => this.interactive && d.phase === 'idle' && !!this.duelist && this.duelist.alive,
      onDone: () => this.begin(),
    });
    this.on('player:hurt', () => { if (this.t >= 0 && !this.over) this.hurt = true; });
  }

  drawChalk(at) {
    const g = this.track(this.scene.add.graphics().setDepth(DEPTH.decals + 4));
    g.lineStyle(5, 0xe8e0d0, 0.55);
    g.strokeEllipse(at.x, at.y, 128, 84);
    g.lineStyle(6, 0xe8e0d0, 0.6);
    g.lineBetween(at.x - 22, at.y - 14, at.x + 22, at.y + 14);
    g.lineBetween(at.x + 22, at.y - 14, at.x - 22, at.y + 14);
  }

  onEnter() {
    if (this.data.phase === 'done' || this.duelist) return;
    this.duelist = spawnEnemy(this.scene, 'duelist', this.foePos.x, this.foePos.y, { floor: this.room.floor || this.scene.floorNum || 1, instant: true });
    if (this.duelist) this.duelist.sprite.setFlipX(true);
  }

  begin() {
    const d = this.data;
    if (d.phase !== 'idle' || !this.duelist || !this.duelist.alive) return;
    d.phase = 'duel';
    this.state.uses = (this.state.uses || 0) + 1;
    this.mark.setVisible(false);
    this.room.lock();
    this.t = 0;
    this.bells = 0;
    this.drawT = drawDelay(this.rng('draw'));
    this.hurt = false;
    this.over = false;
    Sfx.play('duel_start');
    this.musicDip = true; bus.emit('duel:start');
    this.room.banner('THE DUEL', { color: '#e8e0d0', hold: 800 });
  }

  update(dt) {
    super.update(dt);
    if (this.t < 0 || this.over) return;
    if (!this.interactive && this.player && this.player.dead) return;
    this.t += dt;
    const { scene } = this;
    if (this.bells < DUEL.bells.length && this.t >= DUEL.bells[this.bells]) {
      this.bells++;
      Sfx.play('bell_toll');
      scene.fx.text(ROOM.cx, ROOM.cy - 110, String(this.bells), { size: 110, color: '#e8e0d0', time: 850, rise: 20 });
      scene.fx.shake(0.003, 80);
      scene.fx.ringPulse(this.post.x, this.post.y - 40, 0xe8e0d0, 60, 500, 0.6);
    }
    if (!this.drawn && this.t >= this.drawT) {
      this.drawn = true;
      const e = this.duelist;
      if (e && e.alive) e.draw();
      scene.fx.text(ROOM.cx, ROOM.cy - 110, 'DRAW!', { size: 130, color: '#d63a2a', time: 900, rise: 10 });
      scene.fx.shake(0.008, 160);
      scene.fx.flash(0xd63a2a, 0.25);
      Sfx.play('duel_draw');
      bus.emit('duel:draw'); // DRAW moment (Audio / Meta cue)
      this.duelEnd();
    }
    if (this.drawn && this.duelist && !this.duelist.alive) this.win();
  }

  win() {
    const { room, scene, data: d } = this;
    this.over = true;
    d.phase = 'done';
    d.flawless = !this.hurt;
    d.outcome = d.flawless ? 'flawless' : 'won';
    if (scene.run) scene.run.flawlessDuel = d.flawless;
    room.unlock();
    Sfx.play('room_clear');
    room.banner(d.flawless ? 'FLAWLESS DUEL' : 'THE GHOST FADES', { color: d.flawless ? '#f0d060' : '#8fc23f', hold: 1400 });
    room.spawnChest('chest_wood', ROOM.cx, ROOM.cy);
    if (d.flawless) {
      const id = scene.items.roll('treasure', subRng('item', this.def.seed, 0));
      const at = { x: ROOM.cx, y: ROOM.cy - 120 };
      if (id) this.pedestal({ x: at.x, y: at.y, itemId: id });
      else this.pickup('heart_container', at.x, at.y, { pop: true });
    }
    this.finish(d.outcome);
  }

  duelEnd() { if (this.musicDip) { this.musicDip = false; bus.emit('duel:end'); } }

  onLeave() {
    this.duelEnd();
    // torn down mid-duel: the next visit starts from the chalk mark again
    if (this.data.phase === 'duel') this.data.phase = 'idle';
    if (this.duelist && this.duelist.alive) this.duelist = null;
  }
}
