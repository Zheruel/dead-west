// Importing this module registers every item in src/items/defs/*.js (Vite import.meta.glob, eager).
import './registry.js';
import.meta.glob('./defs/*.js', { eager: true });
export { registerItem, getItem, allItems } from './registry.js';
export { default as ItemSystem } from './ItemSystem.js';
