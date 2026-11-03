/** Lightweight, deliberately illustrative district structures.
 * Real OSM building footprints take precedence. The photo study is not a map.
 */
import * as T from '../vendor/three.module.js';
import {collisionAt,nearestPoint,seeded} from './core.mjs';
import {localVisualLayout} from './local-layout.mjs';

const brick=new T.MeshStandardMaterial({color:'#b9b2a2',roughness:.97});
const plaster=new T.MeshStandardMaterial({color:'#c6c5be',roughness:.9});
const retail=new T.MeshStandardMaterial({color:'#b0b8b8',roughness:.7});
const roofGrey=new T.MeshStandardMaterial({color:'#787c78',roughness:.85,metalness:.05});
const roofBrown=new T.MeshStandardMaterial({color:'#8a7166',roughness:.92});
const canopyFloor=new T.MeshStandardMaterial({color:'#486447',roughness:1,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide});
const gravel=new T.MeshStandardMaterial({color:'#b8ac93',roughness:1,side:T.DoubleSide});
function labelTexture(title){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d');x.fillStyle='#142b32';x.fillRect(0,0,512,128);
  x.fillStyle='#d7f5ee';x.fillRect(8,8,496,6);
  x.textAlign='center';x.textBaseline='middle';x.fillStyle='#ffffff';
  x.font='bold 52px system-ui,sans-serif';x.fillText(title,256,65,480);
  x.font='16px system-ui,sans-serif';x.fillStyle='#bbd5cc';x.fillText('ІГРОВИЙ ОРІЄНТИР',256,108,460);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
export function buildLocalStudy(scene,world){
  const layout=localVisualLayout(),group=new T.Group();group.name='Illustrative Centralna 59 district';scene.add(group);
  const windows=[],rng=seeded(5959);let built=0,omitted=0;
  const within=p=>p.x>=world.bounds.minX&&p.x<=world.bounds.maxX&&p.z>=world.bounds.minZ&&p.z<=world.bounds.maxZ;
  const boxes=[];
  for(const b of layout.buildings){
    if(!within(b)){omitted++;continue;}
    // A real mapped building is more authoritative than this approximate
    // screenshot interpretation; do not duplicate or overwrite its footprint.
    let overlaps=false;
    const radius=Math.min(b.width,b.depth)*.25;
    for(const x of [-.42,0,.42])for(const z of [-.42,0,.42]){
      const p={x:b.x+b.width*x,z:b.z+b.depth*z};
      if(collisionAt(world,p,radius*.33)){overlaps=true;break;}
    }
    // Preserve every mapped road and narrow footway. An illustrative
    // commercial building must never block an authentic school footpath.
    const search=Math.max(b.width,b.depth)*.6+8;
    for(const segment of world.roadGrid.near(b.x,b.z,search)){
      if(nearestPoint(b,segment.a,segment.b).distance<
         segment.road.width*.5+Math.min(b.width,b.depth)*.42+1.5){overlaps=true;break;}
    }
    if(overlaps){omitted++;continue;}
    const wall=b.kind==='residential'?(built%3===0?brick:plaster):retail;
    const body=new T.Mesh(new T.BoxGeometry(b.width,b.height,b.depth),wall);
    body.position.set(b.x,b.height/2,b.z);body.castShadow=true;body.receiveShadow=true;group.add(body);
    const roof=new T.Mesh(new T.BoxGeometry(b.width+.65,.20,b.depth+.65),b.kind==='residential'?roofBrown:roofGrey);
    roof.position.set(b.x,b.height+.12,b.z);roof.castShadow=true;roof.receiveShadow=true;group.add(roof);
    if(b.kind==='residential'){
      const floors=Math.max(2,Math.min(6,Math.floor(b.height/3.1)));
      for(let floor=0;floor<floors;floor++){
        const y=2.05+floor*3.05;if(y>b.height-1)continue;
        for(let iz=-b.depth/2+3;iz<b.depth/2-2;iz+=4.8){
          windows.push([b.x-b.width/2-.028,y,b.z+iz,-Math.PI/2,rng()]);
          windows.push([b.x+b.width/2+.028,y,b.z+iz,Math.PI/2,rng()]);
        }
        for(let ix=-b.width/2+2.5;ix<b.width/2-2;ix+=3.5){
          windows.push([b.x+ix,y,b.z+b.depth/2+.028,0,rng()]);
          windows.push([b.x+ix,y,b.z-b.depth/2-.028,Math.PI,rng()]);
        }
      }
    }else{
      const front=new T.Mesh(new T.PlaneGeometry(b.width*.72,2.5),new T.MeshStandardMaterial({
        color:'#263c4c',roughness:.18,metalness:.16,side:T.DoubleSide}));
      front.position.set(b.x,2.0,b.z+b.depth/2+.036);group.add(front);
      if(b.label){
        const sign=new T.Mesh(new T.PlaneGeometry(Math.min(b.width*.91,20),3.5),
          new T.MeshBasicMaterial({map:labelTexture(b.label),transparent:true,side:T.DoubleSide}));
        sign.position.set(b.x,Math.min(b.height-1.2,4.1),b.z+b.depth/2+.12);
        group.add(sign);
      }
    }
    const minX=b.x-b.width/2,maxX=b.x+b.width/2,minZ=b.z-b.depth/2,maxZ=b.z+b.depth/2;
    const poly=[{x:minX,z:minZ},{x:maxX,z:minZ},{x:maxX,z:maxZ},{x:minX,z:maxZ}];
    const collider={poly,minX,maxX,minZ,maxZ,height:b.height,interpretive:true};
    world.obstacles.insert(collider,minX,minZ,maxX,maxZ);
    built++;boxes.push(b.id);
  }
  // Distinct wooded ground tone visible from the first-person camera and map.
  // The circle is an artistic density zone, not a traced park boundary.
  const lawn=new T.Mesh(new T.CircleGeometry(1,64),canopyFloor);
  lawn.rotation.x=-Math.PI/2;
  lawn.position.set(layout.anchor.x-233,.006,layout.anchor.z-60);
  lawn.scale.set(146,210,1);lawn.receiveShadow=true;group.add(lawn);
  // A circular landscaped court is visible in the supplied neighbourhood view.
  // This plaza is deliberately a qualitative study, not a claimed exact shape.
  const p=layout.plaza;
  if(within(p)&&!collisionAt(world,p,2)){
    const outer=new T.Mesh(new T.RingGeometry(p.radius-1.5,p.radius,48),gravel);
    outer.rotation.x=-Math.PI/2;outer.position.set(p.x,.09,p.z);group.add(outer);
    const inner=new T.Mesh(new T.CircleGeometry(p.radius-2.0,48),new T.MeshStandardMaterial({
      color:'#6d8656',roughness:1,side:T.DoubleSide}));
    inner.rotation.x=-Math.PI/2;inner.position.set(p.x,.07,p.z);group.add(inner);
  }
  if(windows.length){
    const pane=new T.InstancedMesh(new T.PlaneGeometry(1.25,1.35),
      new T.MeshStandardMaterial({color:'#4d646c',roughness:.2,metalness:.2,side:T.DoubleSide}),windows.length);
    const dummy=new T.Object3D();
    for(let i=0;i<windows.length;i++){
      const [x,y,z,a,t]=windows[i];
      dummy.position.set(x,y,z);dummy.rotation.set(0,a,0);dummy.updateMatrix();pane.setMatrixAt(i,dummy.matrix);
      pane.setColorAt(i,new T.Color(t<.12?'#9c8870':t<.48?'#758b93':'#d0d4cb'));
    }
    pane.instanceMatrix.needsUpdate=true;pane.instanceColor.needsUpdate=true;group.add(pane);
  }
  return {group,stats:{visualBuildings:built,skippedForOSM:omitted,windows:windows.length,source:'illustrative-photo-study',ids:boxes}};
}
