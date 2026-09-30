// DARKNESS (F2, F3, F5, F6 and the curse of the dark): near-black mask with a flickering lantern disc around the player (spirit_lantern adds a second disc
// of r 200 at each ghost-flame). `room.darkMask` is raised so warn overlays, fire and other fairness cues draw above the mask (depth >= 200);
// enemy bullets already live at 200 > mask 196.
import { MaskMod } from './MaskMod.js';
import SpiritLantern from '../../../items/familiars/SpiritLantern.js';

export class Darkness extends MaskMod {
  constructor(room, cfg) {
    super(room, cfg, 0xd4a4);
    room.darkMask = true;
    this.pool = []; // lantern light records, reused
  }

  lights() {
    const p = this.scene.player, ls = this.mask.lights;
    let n = 0;
    if (p && p.familiars) {
      for (let i = 0; i < p.familiars.length; i++) {
        const f = p.familiars[i];
        if (!(f instanceof SpiritLantern)) continue;
        const l = this.pool[n] || (this.pool[n] = { x: 0, y: 0, radius: this.cfg.lanternRadius, soft: this.cfg.lanternRadius * (this.cfg.mask.soft / this.cfg.mask.radius) });
        l.x = f.x; l.y = f.y;
        ls[n] = l; n++;
      }
    }
    ls.length = n;
  }

  lifted() { this.room.darkMask = false; }
  onDestroy() { super.onDestroy(); this.room.darkMask = false; }
}
export default Darkness;
