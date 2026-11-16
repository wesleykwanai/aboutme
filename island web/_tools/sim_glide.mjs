// sim_glide.mjs — mirrors the fixed glide arc; asserts straight plan line + no y snap
const dt = 1 / 60, LIFT = 26;
function groundY(x, z, world) {
  for (const I of world) {
    if (Math.hypot(x - I.x, z - I.z) < I.r) return I.h;
  }
  return .7; // water
}
function sim(name, world, from, to) {
  const G = { sx: from.x, sy: from.y, sz: from.z, fx: to.x, fz: to.z, gy: groundY(to.x, to.z, world), dist: Math.hypot(to.x - from.x, to.z - from.z), trav: 0, phase: 'fly' };
  let P = { x: from.x, y: from.y, z: from.z };
  let maxStepY = 0, maxStepH = 0, prev = { ...P }, frames = 0, landed = false, landAt = null;
  const dirx = (to.x - from.x) / G.dist, dirz = (to.z - from.z) / G.dist;
  let maxOffLine = 0;
  while (frames++ < 60 * 20) {
    // ---- exact copy of the fixed fly block ----
    const sp = 15 * dt;
    let dx = G.fx - P.x, dz = G.fz - P.z;
    const rem = Math.hypot(dx, dz);
    const _g = groundY(P.x, P.z, world);
    const _land = () => { P.y = Math.max(_g, G.gy); landed = true; landAt = { ...P }; };
    if (rem < .4) { _land(); break; }
    dx /= rem; dz /= rem;
    const step = Math.min(sp, rem);
    P.x += dx * step; P.z += dz * step; G.trav += step;
    const q = Math.max(0, Math.min(1, G.trav / Math.max(.001, G.dist)));
    P.y = G.sy - (G.sy - G.gy) * Math.sin(q * Math.PI / 2);
    if (P.y < _g + .05) { P.y = Math.max(_g, P.y); _land(); break; }
    // ---- checks ----
    maxStepY = Math.max(maxStepY, Math.abs(P.y - prev.y));
    maxStepH = Math.max(maxStepH, Math.hypot(P.x - prev.x, P.z - prev.z));
    maxOffLine = Math.max(maxOffLine, Math.abs((P.x - from.x) * dirz - (P.z - from.z) * dirx));
    prev = { ...P };
  }
  const ok = landed && maxStepY < 0.55 && maxStepH < 0.26 && maxOffLine < 0.01;
  console.log(`[${name}] ${ok ? 'PASS' : 'FAIL'} frames=${frames} land=(${landAt ? landAt.x.toFixed(1) + ',' + landAt.y.toFixed(2) + ',' + landAt.z.toFixed(1) : 'none'}) maxDy=${maxStepY.toFixed(3)} maxDH=${maxStepH.toFixed(3)} offLine=${maxOffLine.toFixed(4)}`);
  return ok;
}

// high island (r=10, h=8) west, low island (r=8, h=.9) east, water .7
const world = [{ x: 0, z: 0, r: 10, h: 8 }, { x: 34, z: 0, r: 8, h: .9 }];
const r = [
  sim('high -> low across water', world, { x: 0, y: 8, z: 0 }, { x: 34, y: .9, z: 0 }),
  sim('high -> low, clipping own cliff', world, { x: 0, y: 8, z: 0 }, { x: 25, y: .7, z: 0 }),
  sim('low -> high (uphill, must land early)', world, { x: 34, y: .9, z: 0 }, { x: 0, y: 8, z: 0 }),
  sim('same level short hop', world, { x: 34, y: .9, z: 0 }, { x: 45, y: .7, z: 0 }),
  sim('diagonal long glide', world, { x: 0, y: 8, z: 0 }, { x: 30, y: .9, z: 18 }),
];
console.log('\n' + (r.every(Boolean) ? 'ALL PASS' : 'HAS FAIL'));
