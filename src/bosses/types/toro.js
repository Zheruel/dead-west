// STUB (FN-1): generic boss (aimed fan + ring, one phase) until the boss job replaces this file. Real behaviour: docs/v2/CHAPTER2.md.
import Boss from '../Boss.js';
import { registerBoss } from '../registry.js';

class Toro extends Boss {}

registerBoss('toro', Toro);
