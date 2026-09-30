// Code-drawn die pips for the loaded_die (CHAPTER2 s5 enemy 2): white dots with a dark rim, laid out like a real die face.
// Draws relative to the Graphics origin (the enemy moves the Graphics to the die's face each frame).

const S = 19; // pip spacing (px)
// pip layouts on a 3x3 grid: [col, row] with -1..1
const LAYOUT = [
  [],
  [[0, 0]],
  [[-1, -1], [1, 1]],
  [[-1, -1], [0, 0], [1, 1]],
  [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
];

/** Pip weights for N = 1..6 (CHAPTER2): 1, 2, 3, 3, 2, 1. */
export const PIP_WEIGHTS = [1, 2, 3, 3, 2, 1];

/**
 * Draw `shown` of the `n` pips of a face (pips pop in one by one). `k` in 0..1 is a pulse used to swell the pips just before the shot.
 * The rim + white fill + a highlight keep it readable on the red die and on the dark carpet.
 */
export function drawPips(g, n, shown = n, k = 0) {
  g.clear();
  const lay = LAYOUT[n] || LAYOUT[1];
  const cnt = Math.min(shown, lay.length);
  // face plate: a soft dark square so the dots read on any part of the sprite
  g.fillStyle(0x1a0806, 0.55).fillRoundedRect(-S * 1.7, -S * 1.55, S * 3.4, S * 3.1, 9);
  const r = 7.2 + k * 1.8;
  for (let i = 0; i < cnt; i++) {
    const px = lay[i][0] * S, py = lay[i][1] * S * 0.92;
    g.fillStyle(0x140606, 1).fillCircle(px, py, r + 2);
    g.fillStyle(0xfff8e8, 1).fillCircle(px, py, r);
    g.fillStyle(0xffffff, 0.9).fillCircle(px - 1.6, py - 1.6, r * 0.32);
  }
}
