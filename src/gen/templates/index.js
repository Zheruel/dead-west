// Template registry: add new template files here (explicit imports keep this runnable under plain node for the self-test).
import floor1 from './floor1.js';
import floor2 from './floor2.js';
import floor3 from './floor3.js';
import special from './special.js';

export default [...floor1, ...floor2, ...floor3, ...special];
