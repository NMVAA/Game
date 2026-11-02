/** In-game route visualization. Markers and furniture are illustrative,
 * while the ground geometry underneath is taken from OpenStreetMap.
 */
import * as T from '../vendor/three.module.js';
import {project,distance,closestRoad,collisionAt,seeded} from './core.mjs';

function canvasMarker(title,subtitle,color){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;
  const c=canvas.getContext('2d');c.clearRect(0,0,768,256);
  c.fillStyle='rgba(9,30,34,.91)';c.beginPath();c.roundRect(12,12,744,232,28);c.fill();
  c.strokeStyle=color;c.lineWidth=8;c.stroke();
  c.font='bold 59px system-ui,sans-serif';c.fillStyle='#f2f5ed';
  c.fillText(title,40,105,690);
  c.font='32px system-ui,sans-serif';c.fillStyle='#b7d8d5';c.fillText(subtitle,40,177,692);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  return tex;
}
function label(group,world,p,title,sub,color,height=4.4){
  const pole=new T.Mesh(new T.CylinderGeometry(.05,.065,height,6),new T.MeshStandardMaterial({color:'#8fa7a2',roughness:.6}));
  pole.position.set(p.x,height/2,p.z);group.add(pole);
  const sign=new T.Mesh(new T.PlaneGeometry(7.3,2.44),new T.MeshBasicMaterial({map:canvasMarker(title,sub,color),transparent:true,side:T.DoubleSide,depthWrite:false}));
  sign.position.set(p.x,height,p.z);group.add(sign);
  return sign;
}
export function makeNeighborhoodOverlay(scene,world,tour,data) {
  if(!tour)return {setVisible(){},update(){}};
  const group=new T.Group();group.name='Game neighbourhood route';scene.add(group);
  const route=tour.route,markerColor='#a9e8d5';
  const segments=[];for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],len=distance(a,b);
    if(len<.1)continue;
    const count=Math.floor(len/6),angle=Math.atan2(b.x-a.x,b.z-a.z);
    for(let k=1;k<=count;k++){const t=k/(count+1);segments.push([a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,angle]);}
  }
  // Repeated path dashes remain under 1 draw call on low-end Android phones.
  if(segments.length){
    const geo=new T.BoxGeometry(.18,.016,2.2),mat=new T.MeshBasicMaterial({color:markerColor,transparent:true,opacity:.7,depthWrite:false});
    const mesh=new T.InstancedMesh(geo,mat,segments.length),dummy=new T.Object3D();
    segments.forEach((p,i)=>{dummy.position.set(p[0],.13,p[1]);dummy.rotation.y=p[2];dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;group.add(mesh);
  }
  const base=new T.MeshBasicMaterial({color:'#b7e5d7',transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false});
  const startRing=new T.Mesh(new T.RingGeometry(2.2,2.55,40),base);
  startRing.rotation.x=-Math.PI/2;startRing.position.set(tour.start.x,.16,tour.start.z);group.add(startRing);
  const endMat=new T.MeshBasicMaterial({color:'#ffd47f',transparent:true,opacity:.82,side:T.DoubleSide,depthWrite:false});
  const endRing=new T.Mesh(new T.RingGeometry(2.6,3.05,48),endMat);
  endRing.rotation.x=-Math.PI/2;endRing.position.set(tour.end.x,.18,tour.end.z);group.add(endRing);
  const homeSign=label(group,world,tour.home,'ЦЕНТРАЛЬНА, 59',
    tour.home.precision==='mapped'?'Адреса з OSM':'Орієнтовна позиція, не точний вхід','#a9e8d5',5.3);
  const schoolSign=label(group,world,tour.school,'ЛІЦЕЙ №6','Вул. Чіатурська, 6 · орієнтир','#ffd47f',6.2);
  // Additional street labels are route annotations, not claims that street signs exist here.
  const signs=[];let previous=null,last=null;
  for(let i=1;i<route.length-1;i++){
    const p=route[i],name=p.name;
    if(!name||name===previous)continue;
    previous=name;
    if(last&&distance(last,p)<90)continue;
    if(distance(p,tour.start)<55||distance(p,tour.end)<55)continue;
    if(signs.length>=7)break;
    signs.push(label(group,world,{x:p.x+4,z:p.z+4},name.slice(0,27),'Вулиця маршруту','#8abfc2',3.8));last=p;
  }
  // Crosswalk paint is drawn only at OSM-tagged crossing nodes in this vicinity.
  const white=new T.MeshBasicMaterial({color:'#f8f1d9',transparent:true,opacity:.82,side:T.DoubleSide});
  let crossings=0;
  for(const e of data.elements||[]){
    if(e.type!=='node'||e.tags?.highway!=='crossing'||!Number.isFinite(e.lon)||!Number.isFinite(e.lat))continue;
    const p=project(e.lon,e.lat);
    if(Math.min(distance(p,tour.home),distance(p,tour.school))>380)continue;
    const nearest=closestRoad(world,p,15);
    if(!nearest||nearest.distance>12)continue;
    const dx=nearest.b.x-nearest.a.x,dz=nearest.b.z-nearest.a.z,angle=Math.atan2(dx,dz),width=Math.min(9,nearest.road.width-1);
    if(width<2)continue;
    for(let stripe=-2;stripe<=2;stripe++){
      const mesh=new T.Mesh(new T.PlaneGeometry(width,.43),white);
      mesh.rotation.set(-Math.PI/2,0,-angle);
      mesh.position.set(p.x+Math.sin(angle)*stripe*.68,.11,p.z+Math.cos(angle)*stripe*.68);
      group.add(mesh);
    }
    if(++crossings>=32)break;
  }
  // Subtle non-surveyed urban props around the school, explicitly decorative.
  const benches=[],rng=seeded(6006);
  for(let i=2;i<route.length-2&&benches.length<13;i+=4){
    const p=route[i];if(distance(p,tour.school)>430)continue;
    const a=route[i-1],b=route[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,side=i%2?1:-1;
    const at={x:p.x+dz/len*side*6,z:p.z-dx/len*side*6};
    if(collisionAt(world,at,2))continue;
    benches.push({p:at,angle:Math.atan2(dx,dz),shade:rng()});
  }
  const wood=new T.MeshStandardMaterial({color:'#8b6b4d',roughness:.95}),metal=new T.MeshStandardMaterial({color:'#475d5e',metalness:.45,roughness:.7});
  for(const b of benches){
    const g=new T.Group();g.position.set(b.p.x,0,b.p.z);g.rotation.y=b.angle;
    const seat=new T.Mesh(new T.BoxGeometry(2.25,.16,.52),wood);seat.position.y=.62;g.add(seat);
    const back=new T.Mesh(new T.BoxGeometry(2.25,.65,.13),wood);back.position.set(0,1.02,-.27);g.add(back);
    for(const x of [-.86,.86]){const leg=new T.Mesh(new T.BoxGeometry(.12,.63,.12),metal);leg.position.set(x,.32,0);g.add(leg);}
    group.add(g);
  }
  const markers=[homeSign,schoolSign,...signs];
  return {
    group,
    setVisible(on){group.visible=!!on;},
    update(t,camera){
      if(!group.visible)return;
      endRing.material.opacity=.62+.22*Math.sin(t*2.3);
      for(const s of markers)s.rotation.y=Math.atan2(camera.position.x-s.position.x,camera.position.z-s.position.z);
    },
    stats:{trailDashes:segments.length,streetSigns:signs.length,crossings,decorativeBenches:benches.length}
  };
}
