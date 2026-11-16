// sim_cam2.mjs — mirrors the direction+radius chase camera in island.html
const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const nr = (a) => { const l = len(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
const lv = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const LIFT = 26;

function run(o) {
  const dt = 1 / 60, speed = o.speed || 14, gs = o.glideSec;
  let _pp = V(), _ppOk = false, _autoOn = false, _camL = 15;
  let _dirSm = V(0, 0, 1), _camDir = nr(V(0, .45, 1));
  let tgt = V(0, LIFT, 0);
  let cam = add(tgt, mul(nr(o.camFrom), o.camDist));
  let prev = cam, maxD = 0, maxStep = 0, behindAt = -1, enterStep = 0;
  for (let f = 0; f < 60 * (gs + 2); f++) {
    const tt = f * dt, glide = tt < gs;
    const P = glide
      ? V(speed * tt, Math.max(0, 2 * (1 - tt / gs)), 0)
      : V(speed * gs, 0, 0);
    if (!_ppOk) { _pp = P; _ppOk = true; }
    const _tV = V(P.x, P.y + LIFT, P.z);
    const auto = !!glide;
    let entered = false;
    if (auto !== _autoOn) {
      _autoOn = auto; entered = true;
      if (auto) {
        let cd = sub(cam, tgt);
        if (len(cd) ** 2 < 1e-4) cd = V(0, .45, 1);
        _camDir = nr(cd);
        _camL = len(sub(cam, tgt));
      }
    }
    if (auto) {
      tgt = lv(tgt, _tV, 1 - Math.pow(.7, dt * 60));
      const vv = V(P.x - _pp.x, 0, P.z - _pp.z);
      if (len(vv) ** 2 > 1e-6) _dirSm = lv(_dirSm, nr(vv), Math.min(1, dt * 6));
      if (len(_dirSm) ** 2 < 1e-4) _dirSm = V(0, 0, 1);
      _dirSm = nr(_dirSm);
      _camL += (15 - _camL) * Math.min(1, dt * 2);
      const dv = nr(V(-_dirSm.x, .45, -_dirSm.z));
      const ang = Math.acos(Math.max(-1, Math.min(1, dot(_camDir, dv))));
      _camDir = nr(lv(_camDir, dv, Math.min(1, 2.0 * dt / Math.max(ang, 1e-4))));
      cam = add(tgt, mul(_camDir, _camL));
    } else {
      tgt = lv(tgt, _tV, 1 - Math.pow(.88, dt * 60));
      let cd = sub(cam, tgt);
      const L = len(cd);
      if (L > 1e-4) cd = mul(cd, 1 / L);
      _camDir = cd;
      _camL += (clamp(L, 12, 22) - _camL) * Math.min(1, dt * 2);
      cam = add(tgt, mul(_camDir, _camL));
    }
    _pp = P;
    const step = len(sub(cam, prev)); prev = cam;
    maxStep = Math.max(maxStep, step);
    if (entered && auto) enterStep = step;
    const d = len(sub(cam, tgt));
    maxD = Math.max(maxD, d);
    if (glide && behindAt < 0 && dot(_camDir, V(-_dirSm.x, 0, -_dirSm.z)) > .8 && tt > .2) behindAt = tt;
  }
  const ok = maxD <= 24.1 && maxStep < 1.0 && enterStep < 1.5 && behindAt > 0 && behindAt < 2.2;
  console.log(`[${o.name}] ${ok ? 'PASS' : 'FAIL'}  maxDist=${maxD.toFixed(2)} maxStep=${maxStep.toFixed(2)} enterStep=${enterStep.toFixed(2)} behindAfter=${behindAt < 0 ? 'never' : behindAt.toFixed(2) + 's'}`);
  return ok;
}

const r = [
  run({ name: 'front camera, glide', camFrom: V(1, .4, 0), camDist: 20, glideSec: 3 }),
  run({ name: 'behind camera, glide', camFrom: V(-1, .4, 0), camDist: 20, glideSec: 3 }),
  run({ name: 'side camera, fast glide', camFrom: V(0, .4, 1), camDist: 22, glideSec: 2.5, speed: 22 }),
  run({ name: 'very far camera (24)', camFrom: V(1, .2, 1), camDist: 24, glideSec: 3 }),
];
console.log('\n' + (r.every(Boolean) ? 'ALL PASS' : 'HAS FAIL'));
