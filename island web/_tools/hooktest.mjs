// TEMP walk-logic harness (delete after verify). Stubs THREE + scene, runs real stepP.
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}length(){return Math.hypot(this.x,this.z);}normalize(){const l=this.length()||1;this.x/=l;this.z/=l;return this;}}
const THREE={Vector3:V3};
const ISLANDS=[
 {id:'center',x:0,z:0,sz:1,terr:true,up:1,dn:1},{id:'north',x:0,z:-20,sz:1},{id:'east',x:20,z:0,sz:1},
 {id:'south',x:0,z:20,sz:1},{id:'west',x:-20,z:0,sz:1}];
const FLOORD=[],FLOORS_=[],FLOORPEND=[];const FH=8;
const SPOKES=[];ISLANDS.forEach((I,i)=>{if(I.parent){const P=ISLANDS.find(o=>o.id===I.parent);if(P)SPOKES.push([P.x,P.z,I.x,I.z]);}else if(i>0)SPOKES.push([0,0,I.x,I.z]);});

function nearestLand(x,z){
 let best=null,bd=1e9;
 const consider=(px,pz)=>{if(walkable(px,pz)){const dd=(px-x)*(px-x)+(pz-z)*(pz-z);if(dd<bd){bd=dd;best=[px,pz];}}};
 for(const I of ISLANDS){const dx=x-I.x,dz=z-I.z,d=Math.hypot(dx,dz)||.001;
  for(let rr=(I.small?4:8*(I.sz||1));rr>=0;rr-=1)consider(I.x+dx/d*Math.min(d,rr),I.z+dz/d*Math.min(d,rr));}
 for(const s of SPOKES){const dx=s[2]-s[0],dz=s[3]-s[1],L2=dx*dx+dz*dz||1;let tt=((x-s[0])*dx+(z-s[1])*dz)/L2;tt=Math.max(0,Math.min(1,tt));consider(s[0]+dx*tt,s[1]+dz*tt);}
 for(const F of FLOORD)consider(F.x,F.z);for(const S of FLOORS_){const dx=S.bx-S.ax,dz=S.bz-S.az,L2=dx*dx+dz*dz||1;let tt=((x-S.ax)*dx+(z-S.az)*dz)/L2;tt=Math.max(0,Math.min(1,tt));consider(S.ax+dx*tt,S.az+dz*tt);}
 return best;}
const NODES={},LINKS={};
ISLANDS.forEach((I,i)=>{NODES['I'+i]=[I.x,I.z];LINKS['I'+i]=[];});
ISLANDS.forEach((I,i)=>{const m='M'+i;if(I.parent){const pi=ISLANDS.findIndex(o=>o.id===I.parent);if(pi<0)return;NODES[m]=[(I.x+ISLANDS[pi].x)/2,(I.z+ISLANDS[pi].z)/2];LINKS['I'+pi].push(m);LINKS[m]=['I'+pi,'I'+i];LINKS['I'+i].push(m);return;}if(!i)return;NODES[m]=[I.x/2,I.z/2];LINKS['I0'].push(m);LINKS[m]=['I0','I'+i];LINKS['I'+i].push(m);});
function nearestNode(x,z){let b=null,bd=1e18;for(const k in NODES){const dx=x-NODES[k][0],dz=z-NODES[k][1],d=dx*dx+dz*dz;if(d<bd){bd=d;b=k;}}return b;}
function islandOf(x,z){for(let i=0;i<ISLANDS.length;i++){const dx=x-ISLANDS[i].x,dz=z-ISLANDS[i].z;if(dx*dx+dz*dz<64)return i;}return -1;}
function buildRoute(px,pz,fx,fz){
 const sn=nearestNode(px,pz),dn=nearestNode(fx,fz);
 if(sn===dn){
  const ny=k=>{const w=NODES[k];return groundY(w[0],w[1]);};
  const ey=(dest?dest.y:.7);
  const isStair=(sn[0]==='S'||sn[0]==='F');
  if(!(isStair&&(Math.abs(ny(sn)-P.position.y)>2.5||Math.abs(ny(sn)-ey)>2.5)))return[new THREE.Vector3(fx,.7,fz)];
  const sKey=(LINKS[sn]||[]).find(n=>n[0]==='S')||sn;
  const fKey=sn[0]==='F'?sn:((LINKS[sKey]||[]).find(n=>n[0]==='F')||sn);
  const wS=NODES[sKey],wF=NODES[fKey];
  const via=(ey>=P.position.y)?[wS,wF]:((sn[0]==='F')?[wF,wS]:[wS]);
  return[...via.map(w=>new THREE.Vector3(w[0],.7,w[1])),new THREE.Vector3(fx,.7,fz)];}
 const prev={[sn]:null},q=[sn];
 while(q.length){const c=q.shift();if(c===dn)break;for(const n of LINKS[c])if(!(n in prev)){prev[n]=c;q.push(n);}}
 if(!(dn in prev))return[new THREE.Vector3(fx,.7,fz)];
 const chain=[];let c=dn;while(c){chain.unshift(c);c=prev[c];}
 const pts=[];const si=islandOf(px,pz);
 if(si>=0){const C0=ISLANDS[si];if(Math.hypot(px-C0.x,pz-C0.z)>1.5)pts.push(new THREE.Vector3(C0.x+2,.7,C0.z+2));}
 for(let i=1;i<chain.length;i++){const key=chain[i],w=NODES[key];
  if(key[0]==='M'){const A=ISLANDS[+LINKS[key][0].slice(1)],B=ISLANDS[+LINKS[key][1].slice(1)];const mh=(I)=>{const dx=w[0]-I.x,dz=w[1]-I.z,d=Math.hypot(dx,dz)||1;const R=(I.small?4.6:8*(I.sz||1))-.4;return new THREE.Vector3(I.x+dx/d*R,.7,I.z+dz/d*R);};pts.push(mh(A),new THREE.Vector3(w[0],.7,w[1]),mh(B));}
  else if(w[0]===0&&w[1]===0)pts.push(new THREE.Vector3(2,.7,2));
  else pts.push(new THREE.Vector3(w[0],.7,w[1]));}
 pts.push(new THREE.Vector3(fx,.7,fz));
 const sm=[pts[0]];let k=0;
 for(let i=1;i<pts.length;i++){if(lineClear(sm[k].x,sm[k].z,pts[i].x,pts[i].z)){if(i===pts.length-1)sm.push(pts[i]);}
  else{sm.push(pts[i-1]);k=sm.length-1;sm.push(pts[i]);k=sm.length-1;}}
 const out=[];for(const q of sm){if(!out.length||Math.hypot(q.x-out[out.length-1].x,q.z-out[out.length-1].z)>.5)out.push(q);}
 for(const q of out){if(!walkable(q.x,q.z)){const nl=nearestLand(q.x,q.z);if(nl){q.x=nl[0];q.z=nl[1];}}}
 return out;}
function lineClear(ax,az,bx,bz){const d=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(d/.5));let ph=groundY(ax,az);
 for(let i=0;i<=n;i++){const px=ax+(bx-ax)*i/n,pz=az+(bz-az)*i/n;if(!walkable(px,pz))return false;const ch=groundY(px,pz);if(Math.abs(ch-ph)>3)return false;ph=ch;}return true;}
function distSeg(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,L2=dx*dx+dz*dz||1;let tt=((px-ax)*dx+(pz-az)*dz)/L2;tt=Math.max(0,Math.min(1,tt));return Math.hypot(px-(ax+dx*tt),pz-(az+dz*tt));}
function onBridge(x,z){for(const s of SPOKES)if(distSeg(x,z,s[0],s[1],s[2],s[3])<1.6)return true;}
ISLANDS.forEach((I,ii)=>{const R0=I.small?4.6:8*(I.sz||1);if(I.up>0||I.dn>0){let fj=0;const mkFloor=L=>{const a=.5+fj*1.7;fj++;const dx=Math.cos(a),dz=Math.sin(a),Rf=R0*.8,cx=I.x+dx*(R0+6+Rf),cz=I.z+dz*(R0+6+Rf),y=.7+L*FH;const er=R0-.8,ex=I.x+dx*er,ez=I.z+dz*er;FLOORD.push({x:cx,z:cz,r:Rf,y});FLOORS_.push({ax:ex,az:ez,bx:cx-dx*(Rf-.8),bz:cz-dz*(Rf-.8),y0:.7,y1:y});FLOORPEND.push({S:'S'+I.id+'_'+L,F:'F'+I.id+'_'+L,sx:ex,sz_:ez,fx:cx-dx*(Rf-.8),fz:cz-dz*(Rf-.8),ii});};for(let f=1;f<=I.up;f++)mkFloor(f);for(let q=1;q<=I.dn;q++)mkFloor(-q);}});
for(const fp of FLOORPEND){NODES[fp.S]=[fp.sx,fp.sz_];NODES[fp.F]=[fp.fx,fp.fz];LINKS['I'+fp.ii].push(fp.S);LINKS[fp.S]=['I'+fp.ii,fp.F];LINKS[fp.F]=[fp.S];}
function walkable(x,z){for(const F of FLOORD){const dx=x-F.x,dz=z-F.z;if(dx*dx+dz*dz<F.r*F.r)return true;}for(const S of FLOORS_){if(distSeg(x,z,S.ax,S.az,S.bx,S.bz)<1.2)return true;}
 for(const I of ISLANDS){const R=I.small?4.6:8*(I.sz||1);const dx=x-I.x,dz=z-I.z;if(dx*dx+dz*dz<R*R)return true;}
 return onBridge(x,z);}
function groundY(x,z,fl){if(fl===undefined)fl=1;if(fl){for(const F of FLOORD){const dx=x-F.x,dz=z-F.z;if(dx*dx+dz*dz<F.r*F.r)return F.y;}for(const S of FLOORS_){const dx=S.bx-S.ax,dz=S.bz-S.az,L2=dx*dx+dz*dz||1;let tt=((x-S.ax)*dx+(z-S.az)*dz)/L2;if(tt>=0&&tt<=1&&Math.hypot(x-(S.ax+dx*tt),z-(S.az+dz*tt))<1.2)return S.y0+tt*(S.y1-S.y0);}}for(const I of ISLANDS){const R=I.small?4.6:8*(I.sz||1);const dx=x-I.x,dz=z-I.z;if(dx*dx+dz*dz<R*R){if(I.terr){const r=Math.sqrt(dx*dx+dz*dz);if(r<R*.2)return 4;if(r<R*.375)return 2.9;if(r<R*.6875)return 1.8;}return .7;}}return onBridge(x,z)?.15:.7;}

// --- state + stepP (logic copied verbatim, visual lines neutered) ---
let walkMode=true,dest=null,route=[];let rtries=0;let flight=null;
const P={position:{x:0,y:.7,z:6},rotation:{x:0,y:0,z:0}};
const NIL={position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{set(){}}};
const body={scale:{set(){}}},headG=NIL,armL=NIL,armR=NIL,legL=NIL,legR=NIL,tail=NIL;
const TAILS={},PROFILE={species:'cat'},TAILS2=null;
const ctl={target:{x:0,y:0,z:0,lerp(){},set(){}}},cam={position:{copy(){return{add(){}}},clone(){return{x:0,y:0,z:0}}}};
function surfacesAt(x,z){const out=[];for(let i=0;i<FLOORD.length;i++){const F=FLOORD[i];const dx=x-F.x,dz=z-F.z;if(dx*dx+dz*dz<F.r*F.r)out.push({k:'d'+i,y:F.y});}for(let i=0;i<FLOORS_.length;i++){const S=FLOORS_[i];const dx=S.bx-S.ax,dz=S.bz-S.az,L2=dx*dx+dz*dz||1;let tt=((x-S.ax)*dx+(z-S.az)*dz)/L2;if(tt>=0&&tt<=1&&Math.hypot(x-(S.ax+dx*tt),z-(S.az+dz*tt))<1.2)out.push({k:'s'+i,y:S.y0+tt*(S.y1-S.y0)});}for(let i=0;i<ISLANDS.length;i++){const I=ISLANDS[i];const R=I.small?4.6:8*(I.sz||1);const dx=x-I.x,dz=z-I.z;if(dx*dx+dz*dz<R*R){let y=.7;if(I.terr){const r=Math.sqrt(dx*dx+dz*dz);if(r<R*.2)y=4;else if(r<R*.375)y=2.9;else if(r<R*.6875)y=1.8;}out.push({k:'i'+i,y});}}if(onBridge(x,z))out.push({k:'b',y:.15});return out;}
function keyOf(cands,y){for(const c of cands)if(Math.abs(c.y-y)<.01)return c.k;return null;}
function stepP(dt){const sp=6*dt;
 const tgt=route.length?route[0]:dest;
 if(tgt){const v=new THREE.Vector3(tgt.x-P.position.x,0,tgt.z-P.position.z);
  const arrive=route.length>1?.9:.35;
  if(v.length()<arrive){if(route.length)route.shift();else dest=null;}
  else{v.normalize();
   const want=Math.atan2(v.x,v.z);let dA=want-P.rotation.y;
   while(dA>Math.PI)dA-=Math.PI*2;while(dA<-Math.PI)dA+=Math.PI*2;
   P.rotation.y+=Math.max(-10*dt,Math.min(10*dt,dA));
   const fx2=Math.sin(P.rotation.y),fz2=Math.cos(P.rotation.y);
   const dot=fx2*v.x+fz2*v.z;
   if(dot>.3){const nx=P.position.x+v.x*sp,nz=P.position.z+v.z*sp;
    if(walkable(nx,nz)){P.position.x=nx;P.position.z=nz;}
    else if(Math.abs(v.x)>1e-4&&walkable(nx,P.position.z))P.position.x=nx;
    else if(Math.abs(v.z)>1e-4&&walkable(P.position.x,nz))P.position.z=nz;
    else{if(route.length)route.shift();else if(dest&&rtries<3){rtries++;route=buildRoute(P.position.x,P.position.z,dest.x,dest.z);}else dest=null;}}}}
 if(!flight){const cands=surfacesAt(P.position.x,P.position.z);let gh;
  if(!P.sup){gh=groundY(P.position.x,P.position.z);P.sup=keyOf(cands,gh);}
  else{const cur=cands.find(c=>c.k===P.sup);
   if(cur){gh=cur.y;}
   else{const reach=cands.filter(c=>c.y-P.position.y<=1.2);
    if(reach.length){reach.sort((a,b)=>Math.abs(a.y-P.position.y)-Math.abs(b.y-P.position.y));gh=reach[0].y;P.sup=reach[0].k;}
    else gh=P.position.y;}}
  P.position.y+=(gh-P.position.y)*Math.min(1,dt*(gh>=P.position.y?8:22));}}

// --- scenarios ---
function run(name,sx,sz,fx,fz,emptyRoute){
 P.position.x=sx;P.position.z=sz;P.position.y=.7;P.rotation.y=0;P.sup=null;dest=null;route=[];rtries=0;
 rtries=0;dest=new THREE.Vector3(fx,.7,fz);
 route=emptyRoute?[]:buildRoute(sx,sz,fx,fz);
 if(name[0]==='E')console.log('E initroute='+JSON.stringify(route.map(v=>[+v.x.toFixed(1),+v.z.toFixed(1)])));
 let frames=0;const maxF=60*60;
 while((dest||route.length)&&frames<maxF){stepP(1/60);frames++;
  if(frames%300===0)console.log('  f'+frames+' pos=('+(+P.position.x.toFixed(1))+','+(+P.position.z.toFixed(1))+') route='+route.length+' w0='+(route.length?(+route[0].x.toFixed(1))+','+(+route[0].z.toFixed(1)):'-'));}
 const d=dest?Math.hypot(dest.x-P.position.x,dest.z-P.position.z):0;
 const ok=!dest&&Math.hypot(fx-P.position.x,fz-P.position.z)<0.6;
 console.log(name+': frames='+frames+' end=('+(+P.position.x.toFixed(1))+','+(+P.position.z.toFixed(1))+',y='+(+P.position.y.toFixed(1))+') '+(ok?'ARRIVED':'STUCK dist='+d.toFixed(2)+' rtries='+rtries));
 return ok;
}
let allOk=true;
allOk&=run('A center->east stand',0,6,18,-1,false);
allOk&=run('B forced water cross, empty route',0,6,14,0,true);
allOk&=run('C forced water cross, with route',0,6,14,0,false);
allOk&=run('D same island short',0,6,-2,-0.8,false);
allOk&=run('E west wing far',0,6,-18,2,false); // DEBUG E only
allOk&=run('F up to 1/F disc',0,6,17.9,9.8,false);
allOk&=run('G down to UG1 disc',17.9,9.8,-12.0,16.5,false);
console.log(allOk?'ALL ARRIVED':'FAILURES PRESENT');

// H lateral stair crossing must NOT teleport up (regression: edge skip bug)
P.position.x=5.12;P.position.y=.7;P.position.z=5.65;P.rotation.y=0;P.sup=null;dest=null;route.length=0;rtries=0;
dest=new THREE.Vector3(7.52,.7,1.26);route=buildRoute(P.position.x,P.position.z,7.52,1.26);
let maxY=0,hf=0;while((dest||route.length)&&hf<1200){stepP(1/60);hf++;if(P.position.y>maxY)maxY=P.position.y;}
console.log((maxY<2?'OK ':'FAIL ')+'H lateral cross maxY='+maxY.toFixed(2)+' frames='+hf+' end=('+P.position.x.toFixed(1)+','+P.position.z.toFixed(1)+')');

// S2 same XZ zone across levels must route via stairs, never direct
P.position.x=17.9;P.position.y=8.7;P.position.z=9.8;P.sup=null;dest=new THREE.Vector3(11,.7,5.5);
const s2r=buildRoute(P.position.x,P.position.z,11,5.5);
const s2ok=s2r.length>=3&&Math.hypot(s2r[0].x-13.0,s2r[0].z-7.1)<.6&&Math.hypot(s2r[1].x-6.32,s2r[1].z-3.45)<.6;
console.log((s2ok?'OK ':'FAIL ')+'S2 route via stairs len='+s2r.length+' w0=('+s2r[0].x.toFixed(1)+','+s2r[0].z.toFixed(1)+') w1=('+s2r[1].x.toFixed(1)+','+s2r[1].z.toFixed(1)+')');
dest=null;route.length=0;

// --- grappling-gun flight test (logic extracted verbatim from island.html) ---
const hookG={position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}},visible:false};
const rope={visible:false,geometry:{attributes:{position:{setXYZ(){},needsUpdate:false}}}};
const cape={rotation:{x:0}};
P.position.set=function(x,y,z){this.x=x;this.y=y;this.z=z;};
function batFly(fx,fy,fz){dest=null;route.length=0;P.sup=null;const sx=P.position.x,sy=P.position.y,sz=P.position.z;const dd=Math.hypot(fx-sx,fy-sy,fz-sz);if(dd<1){P.position.set(fx,fy,fz);return;}flight={sx,sy,sz,fx,fy,fz,t:0,fire:.22,pull:Math.max(.8,Math.min(2.2,dd/18))};hookG.visible=true;rope.visible=true;}
function updateFlight(dt){if(!flight)return;const F=flight;F.t+=dt;
 const gx=P.position.x,gy=P.position.y+1,gz=P.position.z;
 if(F.t<F.fire){const k=F.t/F.fire;hookG.position.set(F.sx+(F.fx-F.sx)*k,F.sy+1+(F.fy+.3-F.sy-1)*k,F.sz+(F.fz-F.sz)*k);}
 else{hookG.position.set(F.fx,F.fy+.3,F.fz);const k=Math.min(1,(F.t-F.fire)/F.pull);const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;P.position.set(F.sx+(F.fx-F.sx)*e,F.sy+(F.fy-F.sy)*e+Math.sin(k*Math.PI)*1.2,F.sz+(F.fz-F.sz)*e);P.rotation.y=Math.atan2(F.fx-F.sx,F.fz-F.sz);cape.rotation.x=-.7;}
 const rp=rope.geometry.attributes.position;rp.setXYZ(0,gx,gy,gz);const hp=hookG.position;rp.setXYZ(1,hp.x,hp.y,hp.z);rp.needsUpdate=true;
 if(F.t>=F.fire+F.pull){flight=null;hookG.visible=false;rope.visible=false;cape.rotation.x=0;const gy2=groundY(P.position.x,P.position.z);P.position.y=gy2;}}

let pass=0,fail=0;
function flyTo(fx,fy,fz,maxF=600){batFly(fx,fy,fz);const sy=P.position.y;let f=0,minY=1e9,maxY=-1e9;while(flight&&f<maxF){stepP(1/60);updateFlight(1/60);f++;if(P.position.y<minY)minY=P.position.y;if(P.position.y>maxY)maxY=P.position.y;}return{f,sy,minY,maxY};}
function chk(n,fx,fy,fz){const r=flyTo(fx,fy,fz);const gy=groundY(fx,fz);const xz=Math.hypot(P.position.x-fx,P.position.z-fz)<.3;const snap=Math.abs(P.position.y-gy)<.01;const vert=fy<r.sy-1?r.minY<=fy+.5:fy>r.sy+1?r.maxY>=fy-.5:true;const ok=!flight&&xz&&snap&&vert;if(ok)pass++;else fail++;console.log((ok?'OK ':'FAIL ')+n+' frames='+r.f+' end=('+P.position.x.toFixed(1)+','+P.position.y.toFixed(1)+','+P.position.z.toFixed(1)+') snapY='+gy.toFixed(1)+' minY='+r.minY.toFixed(1)+' maxY='+r.maxY.toFixed(1));}
// reset walker state between flights
function reset(){P.position.x=0;P.position.y=.7;P.position.z=6;P.rotation.y=0;P.sup=null;dest=null;route.length=0;}
reset();chk('H same-level far',20,.7,0);
reset();chk('H up to 1F disc',17.6,8.7,8.7);
reset();chk('H down to UG1 disc',-11.8,-7.3,-7.3);
reset();batFly(0,.7,6);console.log((!flight?'OK ':'FAIL ')+'H zero-dist immediate');
reset();updateFlight(1/60);console.log('OK H null-flight no-op, cape.x='+cape.rotation.x);
console.log('HOOK '+(fail?('FAIL '+fail):'ALL PASS'));
