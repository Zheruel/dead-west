// STUB (FN-1): a ghostly outlaw for the Quick Draw event until FE-V1 replaces this file (EVENTS s3.7).
import { StubShooter } from '../StubEnemy.js';
import { registerEnemy } from '../registry.js';

class Duelist extends StubShooter {
  init() { super.init(); this.sprite.setTint(0x9fe0d0); this.alphaOverride = 0.9; }
}

registerEnemy('duelist', Duelist);
