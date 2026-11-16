import fs from 'node:fs';
globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const buf = fs.readFileSync('C:/Users/kth/Documents/Website/island web/rogue_hooded.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const l = new GLTFLoader();
l.setMeshoptDecoder(MeshoptDecoder);
l.parse(ab, '', (gltf) => {
  const g = gltf.scene;
  g.scale.setScalar(0.9);
  g.updateMatrixWorld(true);
  const names = [];
  g.traverse(o => {
    if (o.isMesh) {
      const b = new THREE.Box3().setFromObject(o);
      names.push([o.name, b.min.toArray().map(v => +v.toFixed(2)), b.max.toArray().map(v => +v.toFixed(2))]);
    }
  });
  names.forEach(n => console.log(n[0], n[1], n[2]));
}, e => console.log('ERR', e && e.message));
