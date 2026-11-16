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
  console.log('head bone:', headBone && headBone.type, headBone && headBone.name);
  console.log('hood:', hood && hood.type, hood && hood.isSkinnedMesh);
  if (!headBone || !hood) return;

  const hb = new THREE.Vector3().setFromMatrixPosition(headBone.matrixWorld);
  console.log('head bone world pos:', hb.toArray().map(v => +v.toFixed(3)));
  console.log('head bone world scale:', headBone.getWorldScale(new THREE.Vector3()).toArray().map(v => +v.toFixed(4)));
  console.log('hood node world pos:', new THREE.Vector3().setFromMatrixPosition(hood.matrixWorld).toArray().map(v => +v.toFixed(3)));
  console.log('hood node world scale:', hood.getWorldScale(new THREE.Vector3()).toArray().map(v => +v.toFixed(4)));

  // real deformed surface
  const g = hood.geometry;
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  let minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  const pts = [];
  for (let i = 0; i < pos.count; i++) {
    if (hood.getVertexPosition) hood.getVertexPosition(i, v); else v.fromBufferAttribute(pos, i);
    v.applyMatrix4(hood.matrixWorld);
    pts.push([v.x, v.y, v.z]);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }
  console.log('DEFORMED hood world bbox x', minX.toFixed(3), maxX.toFixed(3), 'y', minY.toFixed(3), maxY.toFixed(3), 'z', minZ.toFixed(3), maxZ.toFixed(3));
  console.log('verts:', pts.length);

  // Which horizontal direction is the face? walk south->north, report extremes at mid height
  const cy = (minY + maxY) / 2;
  const mid = pts.filter(p => Math.abs(p[1] - cy) < (maxY - minY) * 0.12);
  const dirZ = (Math.max(...mid.map(p => p[2])) > Math.abs(Math.min(...mid.map(p => p[2])))) ? 1 : -1;
  console.log('face dir z sign:', dirZ);

  // front-most surface at several heights, in head-bone local space
  const bands = [-0.15, -0.05, 0.05, 0.15, 0.25, 0.35].map(f => cy + f * (maxY - minY));
  for (const yy of bands) {
    const band = pts.filter(p => Math.abs(p[1] - yy) < 0.02);
    if (!band.length) { console.log('y', yy.toFixed(3), 'no verts'); continue; }
    const fz = dirZ > 0 ? Math.max(...band.map(p => p[2])) : Math.min(...band.map(p => p[2]));
    const fl = band.filter(p => Math.abs(p[2] - fz) < 0.03);
    console.log('y', yy.toFixed(3), 'frontZ', fz.toFixed(3), 'front x range', Math.min(...fl.map(p => p[0])).toFixed(3), Math.max(...fl.map(p => p[0])).toFixed(3));
  }
  // convert a candidate eye point (world) into head-bone local
  const eyeW = new THREE.Vector3(hb.x + 0.06 * dirZ * 0, cy - (maxY - minY) * 0.05, dirZ > 0 ? maxZ : minZ);
  console.log('test point world-> head local:', []);
}, (e) => console.log('PARSE-ERR', e && e.message || e));
