// Ol' Scratch presentation data + a tiny allocation-free suit painter (Phaser Graphics). Pure data + drawing, no game state.
// The boss card (Cards.showBoss, `boss:intro` payload `slam`) slams these five cards onto the table 0.28 s apart: the Dead Man's Hand
// (aces and eights, black) with the fifth card face down.
export const DEAD_MANS_HAND = [
  { rank: 'A', suit: 'spades' },
  { rank: 'A', suit: 'clubs' },
  { rank: '8', suit: 'spades' },
  { rank: '8', suit: 'clubs' },
  { rank: null, suit: null, faceDown: true },
];
/** Payload block for `boss:intro` (STORY 5.3): cards are code-drawn 60x84 rounded rects, `card_flip` on each. */
export const CARD_SLAM = { cards: DEAD_MANS_HAND, gap: 0.28, w: 60, h: 84, sfx: 'card_flip', at: 'bottom-centre' };
export const SUIT_COLOR = { spades: 0x1a1418, clubs: 0x1a1418, hearts: 0xd63a2a, diamonds: 0xd63a2a };
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Fill a suit glyph centred at (x, y), half-size s, using the current graphics only (no allocation). */
export function drawSuit(g, suit, x, y, s, color) {
  g.fillStyle(color, 1);
  if (suit === 'diamonds') {
    g.fillTriangle(x, y - s, x + s * 0.72, y, x, y + s);
    g.fillTriangle(x, y - s, x - s * 0.72, y, x, y + s);
  } else if (suit === 'hearts') {
    g.fillCircle(x - s * 0.5, y - s * 0.3, s * 0.52);
    g.fillCircle(x + s * 0.5, y - s * 0.3, s * 0.52);
    g.fillTriangle(x - s * 0.98, y - s * 0.12, x + s * 0.98, y - s * 0.12, x, y + s);
  } else if (suit === 'spades') {
    g.fillCircle(x - s * 0.5, y + s * 0.15, s * 0.52);
    g.fillCircle(x + s * 0.5, y + s * 0.15, s * 0.52);
    g.fillTriangle(x - s * 0.98, y + s * 0.02, x + s * 0.98, y + s * 0.02, x, y - s);
    g.fillTriangle(x - s * 0.3, y + s, x + s * 0.3, y + s, x, y + s * 0.2);
  } else { // clubs
    g.fillCircle(x, y - s * 0.5, s * 0.44);
    g.fillCircle(x - s * 0.55, y + s * 0.2, s * 0.44);
    g.fillCircle(x + s * 0.55, y + s * 0.2, s * 0.44);
    g.fillTriangle(x - s * 0.3, y + s, x + s * 0.3, y + s, x, y);
  }
}
