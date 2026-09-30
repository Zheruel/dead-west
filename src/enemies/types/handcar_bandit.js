// STUB (FN-1): shoots one telegraphed aimed bullet at a time until the enemy job replaces this file. Real behaviour: docs/v2/CHAPTER2.md.
import { StubShooter } from '../StubEnemy.js';
import { registerEnemy } from '../registry.js';

class HandcarBandit extends StubShooter {}

registerEnemy('handcar_bandit', HandcarBandit);
