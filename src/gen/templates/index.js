// Template registry: add new template files here (explicit imports keep this runnable under plain node for the self-test).
// A real template replaces the built-in stand-in with the same id (fallback.js), and a floor that has real templates of a kind never uses derived ones.
import floor1 from './floor1.js';
import floor2 from './floor2.js';
import floor3 from './floor3.js';
import floor4 from './floor4.js';
import floor5 from './floor5.js';
import floor6 from './floor6.js';
import chapter1 from './chapter1.js';
import special from './special.js';
import champion from './champion.js';
import event from './event.js';
import crossroads from './crossroads.js';

export default [...floor1, ...floor2, ...floor3, ...floor4, ...floor5, ...floor6, ...chapter1, ...special, ...champion, ...event, ...crossroads];
