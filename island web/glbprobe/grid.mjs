import fs from 'node:fs';
globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const buf = fs.readFileSync('C:/Users/kth/Documents/Website/island web/rogue_hooded.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.parse(ab, '', (gltf) => {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  let headBone = null, hood = null;
  root.traverse(o => {
    if (o.name === 'head' && o.isBone) headBone = o;
    if (o.name === 'Rogue_Head_Hooded') hood = o;
  });
  const hbW = new THREE.Vector3().setFromMatrixPosition(headBone.matrixWorld);
  const q = new THREE.Quaternion(); headBone.getWorldQuaternion(q);
  console.log('head bone world pos', hbW.toArray().map(v=>+v.toFixed(3)), 'rot', q.toArray().map(v=>+v.toFixed(3)));

  const rc = new THREE.Raycaster();
  const rows = [];
  for (let yy = 1.66; yy <= 1.96; yy += 0.03) {
    const row = [];
    for (const xx of [-0.20, -0.15, -0.12, -0.09, -0.05, 0, 0.05, 0.09, 0.12, 0.15, 0.20]) {
      const from = new THREE.Vector3(xx, yy, 3);
      rc.set(from, new THREE.Vector3(0, 0, -1));
      rc.far = 10;
      const hits = rc.intersectObject(hood, true);
      row.push(hits.length ? +hits[0].point.z.toFixed(3) : null);
    }
    rows.push([+yy.toFixed(2), row]);
  }
  console.log('x ->    -0.20  -0.15  -0.12  -0.09  -0.05   0.00   0.05   0.09   0.12   0.15   0.20');
  for (const [yy, row] of rows) console.log(String(yy).padEnd(6), row.map(v => v === null ? '  --  ' : String(v).padEnd(6)).join(' '));
}, (e) => console.log('PARSE-ERR', e && e.message || e));
