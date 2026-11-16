// sim_cam.mjs — replicates the new chase-camera math in island.html and measures jerk/leash
const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
const cp = (a, b) => ({ x: b.x, y: b.y, z: b.z });
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const lerpV = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const norm = (a) => { const l = len(a) || 1; return V(a.x / l, a.y / l, a.z / l); };
const LIFT = 26;

function run({ name, camStart, glideSec, speed = 14, dirFlip = false }) {
  let _pp = V(), _ppOk = false, _autoOn = false, _camL = 15;
  let _dirSm = V(0, 0, 1), ctlTarget = V(0, LIFT, 0);
  let cam = V(0, LIFT + 5, camStart);
  let P = V(0, 0, 0), glide = false;
  const dt = 1 / 60;
  let maxD = 0, maxStep = 0, jumpAtLand = 0, prev = cp(null, cam);
  const trace = [];
  for (let f = 0; f < 60 * (glideSec + 2); f++) {
    const tt = f * dt;
    glide = tt < glideSec;
    if (glide) P = V(speed * tt, Math.max(0, 2 * (1 - tt / glideSec)), 0);
    else P = V(speed * glideSec, 0, 0);
    if (dirFlip && tt > glideSec * 0.5 && glide) P = V(speed * glideSec - speed * (tt - glideSec * 0.5), 0, 0);

    if (!_ppOk) { _pp = cp(null,P); _ppOk = true; }
    const _tV = V(P.x, P.y + LIFT, P.z);
    const auto = !!glide;
    if (auto !== _autoOn) _autoOn = auto;
    if (auto) {
      ctlTarget = lerpV(ctlTarget, _tV, 1 - Math.pow(.7, dt * 60));
      const vv = V(P.x - _pp.x, 0, P.z - _pp.z);
      if (len(vv) ** 2 > 1e-6) _dirSm = lerpV(_dirSm, norm(vv), Math.min(1, dt * 6));
      if (len(_dirSm) ** 2 < 1e-4) _dirSm = V(0, 0, 1);
      _dirSm = norm(_dirSm);
      _camL += (15 - _camL) * Math.min(1, dt * 2);
      const dv = add(ctlTarget, mul(_dirSm, -_camL)); dv.y = ctlTarget.y + 5;
      cam = lerpV(cam, dv, 1 - Math.pow(.55, dt * 60));
      const dd = len(sub(cam, ctlTarget));
      if (dd > 22) cam = add(mul(sub(cam, ctlTarget), 22 / dd), ctlTarget);
      maxD = Math.max(maxD, len(sub(cam, ctlTarget)));
    } else {
      ctlTarget = lerpV(ctlTarget, _tV, 1 - Math.pow(.88, dt * 60));
      const off = sub(cam, ctlTarget); const L = len(off);
      const want = Math.min(22, Math.max(12, L));
      _camL += (want - _camL) * Math.min(1, dt * 2);
      if (L > 1e-4) cam = add(ctlTarget, mul(off, _camL / L));
    }
    _pp = cp(null,P);
    const step = len(sub(cam, prev)); prev = cp(null,cam);
    maxStep = Math.max(maxStep, step);
    if (Math.abs(tt - glideSec) < dt * 1.5) jumpAtLand = Math.max(jumpAtLand, step);
    if (f % 30 === 0) trace.push(`t=${tt.toFixed(1)} d=${len(sub(cam, ctlTarget)).toFixed(1)} step=${step.toFixed(2)}`);
  }
  const verdict = (maxD <= 22.05 && maxStep < 1.6) ? 'PASS' : 'FAIL';
  console.log(`\n[${name}] ${verdict}  maxDist=${maxD.toFixed(2)} maxStepPerFrame=${maxStep.toFixed(2)} landStep=${jumpAtLand.toFixed(2)}`);
  trace.forEach(s => console.log('   ' + s));
  return verdict === 'PASS';
}

const a = run({ name: 'normal glide 3s', camStart: 18, glideSec: 3 });
const b = run({ name: 'cam parked far (24) then glide', camStart: 24, glideSec: 3 });
const c = run({ name: 'fast glide 22u/s', camStart: 18, glideSec: 2.5, speed: 22 });
const d = run({ name: 'reverse mid-air', camStart: 18, glideSec: 3, dirFlip: true });
console.log('\n' + (a && b && c && d ? 'ALL PASS' : 'HAS FAIL'));
