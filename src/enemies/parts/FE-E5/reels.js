// Code-drawn slot reels for the slot_fiend (CHAPTER2 s5 enemy 3): a small brass-framed panel with three windows that spin, stop at
// 0.5 / 0.8 / 1.1 s and show CHERRIES / BELLS / SKULLS or a mismatch. Everything is drawn into one Graphics relative to its origin
// (the panel centre); the enemy moves the Graphics above its head each frame.

export const SYM_CHERRY = 0, SYM_BELL = 1, SYM_SKULL = 2;
export const REEL_STOPS = [0.5, 0.8, 1.1];
export const SPIN_TIME = 1.2;

const PW = 138, PH = 54, WW = 38, WH = 38, GAP = 6; // panel, window size, gap between windows
const GOLD = 0xe6b93c, DARK = 0x1c0c08, CREAM = 0xf3e9cc;

function cherry(g, x, y, s) {
  g.lineStyle(2 * s, 0x2f6a24, 1).lineBetween(x - 5 * s, y + 1 * s, x, y - 9 * s).lineBetween(x + 5 * s, y + 2 * s, x, y - 9 * s);
  g.fillStyle(0x3f8a2c, 1).fillTriangle(x, y - 9 * s, x + 7 * s, y - 11 * s, x + 4 * s, y - 5 * s);
  g.fillStyle(0x6a0d10, 1).fillCircle(x - 5 * s, y + 5 * s, 6.6 * s).fillCircle(x + 5 * s, y + 6 * s, 6.6 * s);
  g.fillStyle(0xd82a2a, 1).fillCircle(x - 5 * s, y + 5 * s, 5.4 * s).fillCircle(x + 5 * s, y + 6 * s, 5.4 * s);
  g.fillStyle(0xffffff, 0.85).fillCircle(x - 7 * s, y + 3 * s, 1.5 * s).fillCircle(x + 3 * s, y + 4 * s, 1.5 * s);
}
function bell(g, x, y, s) {
  g.fillStyle(0x7a4a08, 1).fillCircle(x, y - 9 * s, 3.4 * s);
  g.fillStyle(0x7a4a08, 1).fillCircle(x, y - 1 * s, 9.4 * s).fillTriangle(x - 9.4 * s, y - 1 * s, x + 9.4 * s, y - 1 * s, x + 11.5 * s, y + 8 * s).fillTriangle(x - 9.4 * s, y - 1 * s, x - 11.5 * s, y + 8 * s, x + 11.5 * s, y + 8 * s);
  g.fillStyle(0xf2c132, 1).fillCircle(x, y - 1 * s, 8 * s).fillTriangle(x - 8 * s, y - 1 * s, x + 8 * s, y - 1 * s, x + 10 * s, y + 7 * s).fillTriangle(x - 8 * s, y - 1 * s, x - 10 * s, y + 7 * s, x + 10 * s, y + 7 * s);
  g.fillStyle(0xfff0a0, 0.8).fillCircle(x - 3.5 * s, y - 3 * s, 2.4 * s);
  g.fillStyle(0x7a4a08, 1).fillCircle(x, y + 9.5 * s, 2.8 * s);
}
function skull(g, x, y, s) {
  g.fillStyle(0x140606, 1).fillCircle(x, y - 2 * s, 10.6 * s).fillRect(x - 6.6 * s, y + 4 * s, 13.2 * s, 8 * s);
  g.fillStyle(0xf4ecd8, 1).fillCircle(x, y - 2 * s, 9.4 * s).fillRect(x - 5.4 * s, y + 4 * s, 10.8 * s, 6.4 * s);
  g.fillStyle(0x140606, 1).fillCircle(x - 3.8 * s, y - 2.6 * s, 2.9 * s).fillCircle(x + 3.8 * s, y - 2.6 * s, 2.9 * s).fillTriangle(x, y + 0.6 * s, x - 1.6 * s, y + 3.4 * s, x + 1.6 * s, y + 3.4 * s);
  g.lineStyle(1.2 * s, 0x140606, 1).lineBetween(x - 2 * s, y + 5 * s, x - 2 * s, y + 10 * s).lineBetween(x + 2 * s, y + 5 * s, x + 2 * s, y + 10 * s);
}
const DRAW = [cherry, bell, skull];

/** One symbol at (x, y); used by the spin blur and the final faces. */
export function drawSymbol(g, sym, x, y, s = 1) { DRAW[sym](g, x, y, s); }

/**
 * Draw the panel. `t` = seconds since the pull; `final` = the three stopped symbols; `frame` = window frame colour once all reels have
 * stopped (0 = neutral); `pulse` 0..1 flashes the frame. Reel i spins until REEL_STOPS[i].
 */
export function drawReels(g, t, final, frame = 0, pulse = 0) {
  g.clear();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(-PW / 2 + 3, -PH / 2 + 4, PW, PH, 10);
  g.fillStyle(DARK, 0.95).fillRoundedRect(-PW / 2, -PH / 2, PW, PH, 10);
  g.lineStyle(3, GOLD, 1).strokeRoundedRect(-PW / 2, -PH / 2, PW, PH, 10);
  for (let i = 0; i < 3; i++) {
    const cx = (i - 1) * (WW + GAP), cy = 0;
    g.fillStyle(CREAM, 1).fillRoundedRect(cx - WW / 2, cy - WH / 2, WW, WH, 5);
    const stop = REEL_STOPS[i];
    if (t < stop) {
      // spinning: symbols flick past with vertical blur bars
      const ph = t * 15 + i * 1.7;
      const sym = Math.floor(ph) % 3;
      const off = ((ph % 1) - 0.5) * 22;
      g.fillStyle(0xd9cfb0, 1).fillRect(cx - WW / 2 + 2, cy - WH / 2 + 2, WW - 4, WH - 4);
      DRAW[sym](g, cx, cy + off, 0.82);
      g.fillStyle(0xffffff, 0.35).fillRect(cx - WW / 2 + 5, cy - WH / 2 + 3, 5, WH - 6).fillRect(cx + WW / 2 - 10, cy - WH / 2 + 3, 3, WH - 6);
    } else {
      const since = t - stop;
      const settle = since < 0.12 ? (1 - since / 0.12) * -7 : 0; // small drop-in bounce when the reel locks
      DRAW[final[i]](g, cx, cy + settle, 1);
      if (since < 0.16) g.lineStyle(3, 0xffffff, 1 - since / 0.16).strokeRoundedRect(cx - WW / 2, cy - WH / 2, WW, WH, 5);
    }
    g.lineStyle(2, 0x3a2410, 1).strokeRoundedRect(cx - WW / 2, cy - WH / 2, WW, WH, 5);
    if (frame && t >= REEL_STOPS[2]) g.lineStyle(3, frame, 0.55 + 0.45 * pulse).strokeRoundedRect(cx - WW / 2 - 1, cy - WH / 2 - 1, WW + 2, WH + 2, 6);
  }
}
