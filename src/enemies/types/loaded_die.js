// STUB (FN-1): chases the player until the enemy job replaces this file. Real behaviour: docs/v2/CHAPTER2.md.
import Grunt from '../Grunt.js';
import { registerEnemy } from '../registry.js';

class LoadedDie extends Grunt {}

registerEnemy('loaded_die', LoadedDie);
