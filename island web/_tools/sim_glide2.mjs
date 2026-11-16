// sim_glide2.mjs — faithful takeoff+fly copy of the proposed balancing; asserts no y snap
const dt = 1 / 60;
const groundY = (x, z, W) => { for (const I of W) if (Math.hypot(x - I.x, z - I.z) < I.r) return I.h; return .7; };

function sim(name, W, from, to) {
  const G = { sx: from.x, sy: from.y, sz: from.z, fx: to.x, fz: to.z, gy: groundY(to.x, to.z, W), dist: Math.hypot(to.x - from.x, to.z - from.z), trav: 0, phase: 'takeoff', t: 0 };
  const P = { x: from.x, y: from.y, z: from.z };
  const ui = { x: (to.x - from.x) / G.dist, z: (to.z - from.z) / G.dist };
  let maxDy = 0, maxDH = 0, offLine = 0, prev = { ...P }, f = 0, landed = false, land = null, yMin = 99, yMax = -99;
  while (f++ < 60 * 30) {
    if (G.phase === 'takeoff') {
      G.t += dt;
      if (G.t < .45) { P.y = G.sy + Math.sin(Math.min(1, G.t / .5) * Math.PI) * .8; }
      else G.phase = 'fly';
      maxDy = Math.max(maxDy, Math.abs(P.y - prev.y)); prev = { ...P }; yMin = Math.min(yMin, P.y); yMax = Math.max(yMax, P.y);
      continue;
    }
    const sp = 15 * dt;
    let dx = G.fx - P.x, dz = G.fz - P.z;
    const rem = Math.hypot(dx, dz);
    const _g = groundY(P.x, P.z, W);
    const _land = () => { P.y = Math.max(_g, G.gy); landed = true; land = { ...P }; };
    if (rem < .4) { _land(); break; }
    dx /= rem; dz /= rem;
    const step = Math.min(sp, rem);
    P.x += dx * step; P.z += dz * step; G.trav += step;
    const q = Math.max(0, Math.min(1, G.trav / Math.max(.001, G.dist)));
    const yA = G.sy - (G.sy - G.gy) * Math.sin(q * Math.PI / 2);
    const _g2 = groundY(P.x, P.z, W);
    if (_g2 > P.y + 1.0) { _land(); break; }
    const yW = Math.max(yA, _g2 + .05);
    P.y += Math.max(-6 * dt, Math.min(6 * dt, yW - P.y));
    maxDy = Math.max(maxDy, Math.abs(P.y - prev.y));
    maxDH = Math.max(maxDH, Math.hypot(P.x - prev.x, P.z - prev.z));
    offLine = Math.max(offLine, Math.abs((P.x - from.x) * ui.z - (P.z - from.z) * ui.x));
    yMin = Math.min(yMin, P.y); yMax = Math.max(yMax, P.y);
    prev = { ...P };
  }
  const reached = land && Math.hypot(land.x - to.x, land.z - to.z) < 1.5;
  const ok = landed && reached && maxDy < .32 && maxDH < .26 && offLine < .01;
  console.log(`[${name}] ${ok ? 'PASS' : 'FAIL'} f=${f} land=(${land ? land.x.toFixed(1) + ',' + land.y.toFixed(2) + ',' + land.z.toFixed(1) : 'NONE'}) maxDy=${maxDy.toFixed(3)} maxDH=${maxDH.toFixed(3)} offLine=${offLine.toFixed(4)} yRange=${yMin.toFixed(1)}..${yMax.toFixed(1)}`);
  return ok;
}

const W = [{ x: 0, z: 0, r: 10, h: 8 }, { x: 34, z: 0, r: 8, h: .9 }];
const r = [
  sim('plateau -> low island (crosses own cliff)', W, { x: 0, y: 8, z: 0 }, { x: 34, y: .9, z: 0 }),
  sim('plateau edge -> far water', W, { x: 0, y: 8, z: 0 }, { x: 25, y: .7, z: 0 }),
  sim('low -> high island centre (uphill)', W, { x: 34, y: .9, z: 0 }, { x: 0, y: 8, z: 0 }),
  sim('diagonal long glide', W, { x: 0, y: 8, z: 0 }, { x: 30, y: .9, z: 18 }),
  sim('same plateau hop', W, { x: -4, y: 8, z: 0 }, { x: 4, y: 8, z: 0 }),
];
console.log('\n' + (r.every(Boolean) ? 'ALL PASS' : 'HAS FAIL'));
