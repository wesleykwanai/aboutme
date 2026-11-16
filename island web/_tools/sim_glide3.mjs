// self-check: steep high->low glide must not teleport down at the end
const cases = [
  { name: 'drop 30 / dist 12 (extreme)', sy: 30, gy: 0, dist: 12 },
  { name: 'drop 20 / dist 15', sy: 20, gy: 0, dist: 15 },
  { name: 'drop 8 / dist 40 (gentle)', sy: 8, gy: 0, dist: 40 },
];
let bad = 0;
for (const c of cases) {
  let y = c.sy, trav = 0, dt = 1 / 60, frames = 0, maxStep = 0, landed = false;
  while (frames++ < 3000) {
    const rem = c.dist - trav;                       // horizontal only, 1D
    if (rem < 0.4) {
      const gn = c.gy;
      if (y - gn > 0.5) { const d = Math.min(24 * dt, y - gn - 0.05); y -= d; maxStep = Math.max(maxStep, d); continue; }
      landed = true; y = Math.max(gn, c.gy); break;
    }
    const step = Math.min(15 * dt, rem);
    trav += step;
    const q = Math.max(0, Math.min(1, trav / Math.max(0.001, c.dist)));
    const yA = c.sy - (c.sy - c.gy) * q;
    const d = Math.max(-24 * dt, Math.min(24 * dt, Math.max(yA, c.gy + 0.05) - y));
    y += d; maxStep = Math.max(maxStep, Math.abs(d));
  }
  const jump = maxStep * 60;                          // units per second (worst frame)
  const ok = landed && jump <= 24.5;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name}: frames=${frames} maxVertRate=${jump.toFixed(2)}u/s landed=${landed} y=${y.toFixed(2)}`);
}
console.log(bad ? `${bad} FAILED` : 'ALL PASS (no snap)');
