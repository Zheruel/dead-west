// FE-E4 helper (pure, node-importable): the breadcrumb path a chain gang's head leaves behind. Links sit at fixed arc distances along it.
// Fixed-size ring buffer, no allocation after construction; `at()` writes into a caller-owned point.

export class Trail {
  constructor(cap = 96, minStep = 6) {
    this.cap = cap;
    this.minStep2 = minStep * minStep;
    this.xs = new Float32Array(cap);
    this.ys = new Float32Array(cap);
    this.head = 0; // index of the newest point
    this.n = 0;
  }

  clear() { this.n = 0; this.head = 0; }

  /** Append (x, y) unless it is closer than `minStep` to the newest point. */
  push(x, y) {
    if (this.n > 0) {
      const dx = x - this.xs[this.head], dy = y - this.ys[this.head];
      if (dx * dx + dy * dy < this.minStep2) return;
    }
    this.head = (this.head + 1) % this.cap;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    if (this.n < this.cap) this.n++;
  }

  /**
   * The point `dist` px behind the leader, measured along the trail starting at the leader's live position (hx, hy).
   * When the trail is shorter than `dist` the oldest point is returned. Writes `out.x/out.y` and returns `out`.
   */
  at(hx, hy, dist, out) {
    let px = hx, py = hy, rem = dist;
    for (let k = 0; k < this.n; k++) {
      const i = (this.head - k + this.cap) % this.cap;
      const qx = this.xs[i], qy = this.ys[i];
      const seg = Math.hypot(qx - px, qy - py);
      if (seg >= rem && seg > 0) {
        const t = rem / seg;
        out.x = px + (qx - px) * t; out.y = py + (qy - py) * t;
        return out;
      }
      rem -= seg; px = qx; py = qy;
    }
    out.x = px; out.y = py;
    return out;
  }
}
