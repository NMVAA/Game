import * as T from '../vendor/three.module.js';
import { seeded, inside, closestRoad, collisionAt, distance } from './core.mjs';
import {visualLandcoverSites} from './landscape.mjs';
export { T };
const palette = ['#c8b4a1','#b8c2bb','#c4bfb0','#d3c4af','#a9b7c0','#cebcae'];
function noiseTexture(base, spread = 18) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d'),im=c.createImageData(128,128),rng=seeded(82);
  for(let i=0;i<im.data.length;i+=4){const n=(rng()-.5)*spread;for(let j=0;j<3;j++)im.data[i+j]=base[j]+n;im.data[i+3]=255;}
  c.putImageData(im,0,0);const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function geometry(positions, colors, uvs) {
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));if(uvs)g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function roadQuad(buf,a,b,width,y) {
  const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<.1)return;
  const nx=dz/l*width*.5,nz=-dx/l*width*.5;
  const p=[[a.x+nx,y,a.z+nz],[b.x+nx,y,b.z+nz],[b.x-nx,y,b.z-nz],[a.x-nx,y,a.z-nz]];
  for(const i of [0,1,2,0,2,3]){buf.p.push(...p[i]);buf.uv.push(p[i][0]*.3,p[i][2]*.3);}
}
function disc(buf,x,z,r,y) {for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;for(const p of [[x,y,z],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(a)*r,y,z+Math.sin(a)*r]]){buf.p.push(...p);buf.uv.push(p[0]*.3,p[2]*.3);}}}
function mergeGeometries(list) {
  const arrays={position:[],normal:[],color:[],uv:[]};
  for(const [g,color] of list){const geom=g.index?g.toNonIndexed():g;const count=geom.attributes.position.count;for(const key of ['position','normal','uv']){const attr=geom.attributes[key];if(attr)arrays[key].push(...attr.array);}
    for(let i=0;i<count;i++)arrays.color.push(color.r,color.g,color.b);if(geom!==g)geom.dispose();g.dispose();}
  const out=new T.BufferGeometry();for(const [name,a] of Object.entries(arrays))if(a.length)out.setAttribute(name,new T.Float32BufferAttribute(a,name==='uv'?2:3));out.computeBoundingSphere();return out;
}
function polygon(points,y,material,scene) {
  if(points.length<3)return;
  const shape=new T.Shape(points.map(p=>new T.Vector2(p.x,-p.z)));
  const geo=new T.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);geo.translate(0,y,0);
  const m=new T.Mesh(geo,material);m.receiveShadow=true;scene.add(m);
}
export function setupScene(canvas) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.background=new T.Color('#b6c8ce');scene.fog=new T.FogExp2('#b6c8ce',.00105);
  const camera=new T.PerspectiveCamera(58,1,.15,4500);
  const hemi=new T.HemisphereLight('#c1d9f3','#766753',1.6);scene.add(hemi);
  const sun=new T.DirectionalLight('#ffe1b4',3.2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:360});sun.shadow.bias=-.00035;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
  const grass=noiseTexture([103,116,81],28);grass.repeat.set(1100,1100);
  const ground=new T.Mesh(new T.PlaneGeometry(14000,14000),new T.MeshStandardMaterial({map:grass,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.045;ground.receiveShadow=true;scene.add(ground);
  const skyUniform={top:{value:new T.Color('#6b9fc2')},bottom:{value:new T.Color('#e8d8bf')}};
  const sky=new T.Mesh(new T.SphereGeometry(3000,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:skyUniform,vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;uniform vec3 top;uniform vec3 bottom;void main(){float h=clamp(normalize(vP).y,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.55)),1.);}'}));scene.add(sky);
  const envCanvas=document.createElement('canvas');envCanvas.width=256;envCanvas.height=128;const ec=envCanvas.getContext('2d'),gr=ec.createLinearGradient(0,0,0,128);gr.addColorStop(0,'#8faac6');gr.addColorStop(.47,'#eff2ec');gr.addColorStop(.51,'#535e4d');gr.addColorStop(1,'#343b33');ec.fillStyle=gr;ec.fillRect(0,0,256,128);ec.fillStyle='#ffefd3';ec.fillRect(40,35,20,18);const et=new T.CanvasTexture(envCanvas);et.mapping=T.EquirectangularReflectionMapping;et.colorSpace=T.SRGBColorSpace;const gen=new T.PMREMGenerator(renderer),env=gen.fromEquirectangular(et);scene.environment=env.texture;et.dispose();gen.dispose();
  function lighting(night){hemi.intensity=night?.32:1.6;sun.intensity=night?.2:3.2;skyUniform.top.value.set(night?'#071124':'#6b9fc2');skyUniform.bottom.value.set(night?'#253c56':'#e8d8bf');scene.fog.color.set(night?'#142237':'#b6c8ce');scene.background.copy(scene.fog.color);renderer.toneMappingExposure=night?1.3:1.15;}
  function followSun(p){sun.position.set(p.x-70,120,p.z-65);sun.target.position.set(p.x,0,p.z);sky.position.set(p.x,0,p.z);}
  return {renderer,scene,camera,sun,hemi,lighting,followSun};
}
export async function buildWorld(scene,world,onProgress=()=>{}) {
  const asphalt=new T.MeshStandardMaterial({map:noiseTexture([70,74,78],15),roughness:.96,side:T.DoubleSide});
  const shoulder=new T.MeshStandardMaterial({color:'#b3aea1',roughness:1,side:T.DoubleSide}),walk=new T.MeshStandardMaterial({color:'#bdad92',roughness:1,side:T.DoubleSide});
  const road={p:[],uv:[]},paving={p:[],uv:[]},paths={p:[],uv:[]},marks=[];
  for(const r of world.roads){const buf=r.drive?road:paths;
    for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];roadQuad(buf,a,b,r.width,r.drive?.065:.05);if(r.drive)roadQuad(paving,a,b,r.width+2.4,.025);
      const len=distance(a,b),angle=Math.atan2(b.x-a.x,b.z-a.z);
      if(r.drive&&r.width>=7)for(let k=5;k<len-3;k+=12){const t=k/len;marks.push([a.x+(b.x-a.x)*t,.077,a.z+(b.z-a.z)*t,angle,.12,3]);}
    }
    for(const p of r.points){disc(buf,p.x,p.z,r.width*.5,r.drive?.066:.051);if(r.drive)disc(paving,p.x,p.z,r.width*.5+1.2,.026);}
  }
  for(const [buf,mat] of [[paving,shoulder],[road,asphalt],[paths,walk]]){const mesh=new T.Mesh(geometry(buf.p,null,buf.uv),mat);mesh.receiveShadow=true;scene.add(mesh);}
  const dummy=new T.Object3D();
  function instances(geo,mat,entries,shadows=true){if(!entries.length)return null;const m=new T.InstancedMesh(geo,mat,entries.length);for(let i=0;i<entries.length;i++){const e=entries[i];dummy.position.set(e[0],e[1],e[2]);dummy.rotation.set(0,e[3]||0,0);dummy.scale.set(e[4]??1,e[5]??1,e[6]??1);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.instanceMatrix.needsUpdate=true;m.castShadow=shadows;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);return m;}
  instances(new T.BoxGeometry(1,.008,1),new T.MeshStandardMaterial({color:'#e8dfbd',roughness:1}),marks.map(e=>[e[0],e[1],e[2],e[3],e[4],1,e[5]]),false);
  const parkMat=new T.MeshStandardMaterial({color:'#657d52',roughness:1,side:T.DoubleSide});world.parks.forEach(p=>polygon(p,.008,parkMat,scene));world.water.forEach(p=>polygon(p,.01,new T.MeshStandardMaterial({color:'#537e8c',metalness:.35,roughness:.25,side:T.DoubleSide}),scene));
  const uniforms={night:{value:0}},walls=new T.MeshStandardMaterial({vertexColors:true,roughness:.9});
  walls.onBeforeCompile=shader=>{shader.uniforms.uNight=uniforms.night;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;vN=normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vW;varying vec3 vN;uniform float uNight;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float axis=abs(vN.x)>abs(vN.z)?vW.z:vW.x;
      vec2 cell=vec2(fract(axis/3.1),fract((vW.y-.55)/3.1));
      float win=step(.19,cell.x)*step(cell.x,.73)*step(.23,cell.y)*step(cell.y,.77)*step(abs(vN.y),.3)*step(1.6,vW.y);
      float lit=step(.56,fract(sin(floor(axis/3.1)*13.7+floor(vW.y/3.1)*7.3)*43758.54));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.19,.23),win*.88);
      if(abs(vN.y)>.7)diffuseColor.rgb*=.65;
    `).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.6,.23)*win*lit*uNight*.9;');
  };
  const chunks=new Map(),roofChunks=new Map();
  const roofPalette=['#736d66','#9b8176','#999992','#786d66','#ad9b86','#717d81'];
  for(let i=0;i<world.buildings.length;i++){const b=world.buildings[i],shape=new T.Shape(b.poly.map(p=>new T.Vector2(p.x,-p.z))),geo=new T.ExtrudeGeometry(shape,{depth:b.height,bevelEnabled:false,curveSegments:1,steps:1});geo.rotateX(-Math.PI/2);
    const key=`${Math.floor(b.minX/220)},${Math.floor(b.minZ/220)}`;
    if(!chunks.has(key))chunks.set(key,[]);
    chunks.get(key).push([geo,new T.Color(palette[Math.floor(b.color*palette.length)])]);
    // A separate roof surface breaks up the previous monochrome extrusions.
    // Roof colour is an artistic material choice, not a surveyed roof attribute.
    const roof=new T.ShapeGeometry(shape);
    roof.rotateX(-Math.PI/2);roof.translate(0,b.height+.035,0);
    if(!roofChunks.has(key))roofChunks.set(key,[]);
    roofChunks.get(key).push([roof,new T.Color(roofPalette[Math.floor(b.color*roofPalette.length)])]);
    if(i%160===0){onProgress(.2+i/world.buildings.length*.4);await new Promise(r=>setTimeout(r,0));}
  }
  for(const list of chunks.values()){const m=new T.Mesh(mergeGeometries(list),walls);m.castShadow=true;m.receiveShadow=true;scene.add(m);}
  const roofMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.92,side:T.DoubleSide});
  for(const list of roofChunks.values()){const mesh=new T.Mesh(mergeGeometries(list),roofMat);mesh.receiveShadow=true;scene.add(mesh);}
  const rng=seeded(634),trees=[],trunks=[],conifers=[],understory=[],lampPosts=[],lampHeads=[];
  for(const r of world.roads.filter(r=>r.drive&&r.width>=7))for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],b=r.points[i],len=distance(a,b);if(len<25)continue;const nx=(b.z-a.z)/len,nz=-(b.x-a.x)/len;
    for(let d=16;d<len;d+=28){const t=d/len;
      for(const side of [-1,1]){const off=r.width*.5+5.6,p={x:a.x+(b.x-a.x)*t+nx*off*side,z:a.z+(b.z-a.z)*t+nz*off*side};const nearest=closestRoad(world,p,15);
        if(trees.length<1400&&!collisionAt(world,p,2.5)&&(!nearest||nearest.distance>nearest.road.width*.5+2)){const h=2.7+rng()*2;trees.push([p.x,h+1.6,p.z,rng()*6,2.3,h,2.3]);trunks.push([p.x,1.5,p.z,0,1,1,1]);const o={...p,circle:true,radius:.23};world.obstacles.insert(o,p.x-.3,p.z-.3,p.x+.3,p.z+.3);}
      }
    }
    for(let d=10;d<len;d+=65){const t=d/len,off=r.width*.5+1,x=a.x+(b.x-a.x)*t+nx*off,z=a.z+(b.z-a.z)*t+nz*off;lampPosts.push([x,3.6,z,0,1,1,1]);lampHeads.push([x,7.25,z,0,1,1,1]);}
  }
  // Satellite-guided vegetation is concentrated west of Centralna 59,
  // while the exact road and building clearances remain driven by OSM.
  const landcover=visualLandcoverSites(world,{maxTrees:310,maxShrubs:460});
  for(const t of landcover.trees){
    if(t.kind==='conifer')conifers.push([t.x,4.5,t.z,t.tone*6.28,t.radius,t.height*.67,t.radius]);
    else trees.push([t.x,t.height+1.6,t.z,t.tone*6.28,t.radius,t.height*.78,t.radius]);
    trunks.push([t.x,1.5,t.z,0,1,1,1]);
    const o={x:t.x,z:t.z,circle:true,radius:.2};
    world.obstacles.insert(o,t.x-.3,t.z-.3,t.x+.3,t.z+.3);
  }
  for(const s of landcover.shrubs)understory.push([s.x,s.height*.5,s.z,s.tone*6.28,s.radius,s.height*.6,s.radius]);
  instances(new T.CylinderGeometry(.16,.22,3,6),new T.MeshStandardMaterial({color:'#6b5944',roughness:1}),trunks);
  instances(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#557647',roughness:1,flatShading:true}),trees);
  instances(new T.ConeGeometry(1,2,8),new T.MeshStandardMaterial({color:'#476653',roughness:1,flatShading:true}),conifers);
  instances(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:'#5f7f52',roughness:1,flatShading:true}),understory,false);
  instances(new T.CylinderGeometry(.07,.12,7.2,5),new T.MeshStandardMaterial({color:'#667077',metalness:.6,roughness:.5}),lampPosts,false);
  const lampMat=new T.MeshStandardMaterial({color:'#ece9d0',emissive:'#ffcc7e',emissiveIntensity:.05});instances(new T.BoxGeometry(.75,.14,.4),lampMat,lampHeads,false);
  onProgress(1);return {setNight(n){uniforms.night.value=n?1:0;lampMat.emissiveIntensity=n?2:.05;},trees:trees.length+conifers.length,landscape:{...landcover.metadata,roofCount:world.buildings.length}};
}
function roundedBox(w,h,l,r=.1){const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new T.ExtrudeGeometry(s,{depth:l,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:1,steps:1,curveSegments:3});g.translate(0,0,-l/2);return g;}
export function makeCar(color='#268c9c',detailed=true){
  const group=new T.Group(),body=new T.Group();group.add(body);
  const paint=new T.MeshStandardMaterial({color,metalness:.65,roughness:.28}),glass=new T.MeshStandardMaterial({color:'#1b303c',metalness:.5,roughness:.16}),black=new T.MeshStandardMaterial({color:'#181c21',roughness:.75}),chrome=new T.MeshStandardMaterial({color:'#9ba5aa',metalness:.85,roughness:.22});
  function mesh(g,m,x,y,z,parent=body){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  mesh(roundedBox(1.85,.53,4.15),paint,0,.76,0);mesh(roundedBox(1.65,.67,1.93,.18),glass,0,1.31,-.12);mesh(roundedBox(1.51,.12,1.46,.06),paint,0,1.69,-.2);
  mesh(roundedBox(1.77,.16,1.13,.04),paint,0,1.02,1.31);mesh(roundedBox(1.72,.13,.6,.04),paint,0,1.04,-1.64);
  mesh(new T.BoxGeometry(1.75,.16,.15),black,0,.52,2.12);mesh(new T.BoxGeometry(1.75,.18,.15),black,0,.51,-2.12);
  const headMat=new T.MeshStandardMaterial({color:'#e6f5ff',emissive:'#d0edff',emissiveIntensity:.7}),tailMat=new T.MeshStandardMaterial({color:'#8e101a',emissive:'#fa1625',emissiveIntensity:.4});
  for(const x of [-.64,.64]){mesh(new T.BoxGeometry(.43,.105,.08),headMat,x,.88,2.13);mesh(new T.BoxGeometry(.43,.12,.08),tailMat,x,.9,-2.13);}
  if(detailed){for(const x of [-.86,.86]){mesh(new T.BoxGeometry(.07,.6,.08),paint,x,1.3,-.2);mesh(roundedBox(.22,.12,.3,.025),paint,x*1.18,1.28,.55);mesh(new T.BoxGeometry(.06,.035,.25),chrome,x*1.09,1.06,-.42);}mesh(new T.BoxGeometry(.48,.13,.03),chrome,0,.67,-2.22);mesh(new T.BoxGeometry(.9,.2,.03),black,0,.75,2.2);}
  const wheels=[];for(const x of [-.96,.96])for(const z of [-1.36,1.36]){const pivot=new T.Group();pivot.position.set(x,.4,z);group.add(pivot);const spin=new T.Group();pivot.add(spin);const tire=mesh(new T.CylinderGeometry(.39,.39,.26,16),black,0,0,0,spin);tire.rotation.z=Math.PI/2;const rim=mesh(new T.CylinderGeometry(.235,.235,.274,12),chrome,0,0,0,spin);rim.rotation.z=Math.PI/2;
    if(detailed)for(let a=0;a<5;a++){const spoke=mesh(new T.BoxGeometry(.29,.035,.38),black,0,0,0,spin);spoke.rotation.x=a*Math.PI/5;}
    wheels.push({pivot,spin,front:z>0});}
  const lamps=[];if(detailed)for(const x of [-.65,.65]){const light=new T.SpotLight('#c9e7ff',0,65,.36,.65,1.3);light.position.set(x,.9,2.2);const target=new T.Object3D();target.position.set(x,.15,28);group.add(light,target);light.target=target;lamps.push(light);}
  return {group,body,wheels,paint,tailMat,lamps,update(speed,steer,dt,brake){for(const w of wheels){w.spin.rotation.x+=speed*dt/.39;if(w.front)w.pivot.rotation.y=-steer*.38;}body.rotation.z+=(steer*Math.min(Math.abs(speed)/30,1)*.035-body.rotation.z)*Math.min(1,dt*8);tailMat.emissiveIntensity=brake?3:.4;}};
}
export function makeBeacon(scene){const group=new T.Group(),mat=new T.MeshBasicMaterial({color:'#ffce7d',transparent:true,opacity:.8,depthWrite:false});const ring=new T.Mesh(new T.TorusGeometry(4,.12,8,64),mat);ring.rotation.x=Math.PI/2;ring.position.y=.16;group.add(ring);const upper=new T.Mesh(new T.OctahedronGeometry(1.1),new T.MeshStandardMaterial({color:'#ffce7d',emissive:'#d59029',emissiveIntensity:.6,metalness:.4,roughness:.25}));upper.position.y=5.5;group.add(upper);const beam=new T.Mesh(new T.CylinderGeometry(.12,.12,5,8),mat);beam.position.y=2.65;group.add(beam);scene.add(group);return{group,update(t){upper.rotation.y=t*.7;upper.position.y=5.5+Math.sin(t*2)*.35;ring.rotation.z=t*.15;}};}
