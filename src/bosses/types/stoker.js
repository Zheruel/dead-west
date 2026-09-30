// STUB (FN-1): generic mini-boss (aimed fan + ring, roar at 50 %) until FE-M1 replaces this file. Real behaviour: docs/v2/EVENTS_MINIBOSSES.md s4.3.
import MiniBoss from '../MiniBoss.js';
import { registerBoss } from '../registry.js';

class Stoker extends MiniBoss {}

registerBoss('stoker', Stoker);
