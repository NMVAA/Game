/** Map and route presentation. Uses only the bundled map, never external tiles. */
import * as T from '../vendor/three.module.js';
import {clamp, distance, nearestPoint} from './core.mjs';
export const RELEASE = '0.3.0';
export function navigation({scene,world,state,player,mapTexture,mapScale,getRoute,getMission,isFree,pause,notice}) {
  const $=id=>document.getElementById(id);
  const style=document.createElement('style');
  style.textContent=`
    #navigation{pointer-events:auto;cursor:pointer}#minimap:focus-visible{outline:2px solid var(--mint)}
    #atlas{z-index:20;background:#101e24;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);overflow:hidden;flex-direction:column}
    .atlas-head{width:100%;padding:12px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line)}
    .atlas-head div{flex:1}.atlas-head h2{margin:0;font-size:18px}.atlas-head p{font-size:10px;color:var(--muted);margin:4px 0 0}
    #atlas-view{display:block;width:100%;min-height:0;flex:1;touch-action:none}
    .atlas-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;width:100%;font-size:11px;color:var(--muted)}
    .atlas-tools{display:flex;gap:6px}.atlas-tools button{min-width:44px;padding:8px 10px}
    #atlas-note{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .paint-title{font-size:10px;color:var(--muted);margin:12px 0 8px}.paint-swatches{display:flex;gap:8px;flex-wrap:wrap}
    .paint-swatches button{width:40px;min-height:40px;border:2px solid transparent;border-radius:50%;padding:5px;background:var(--swatch)}
    .paint-swatches button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #10191e inset}
    @media(max-height:500px){.atlas-head{padding:6px 16px}.atlas-head h2{font-size:15px}.atlas-bottom{padding:5px 16px}.atlas-tools button{min-height:36px}}
  `;document.head.append(style);
  const root=document.createElement('section');root.id='atlas';root.className='overlay';root.hidden=true;
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','atlas-title');
  root.innerHTML='<div class="atlas-head"><div><h2 id="atlas-title">КАРТА МІСТА</h2><p>Покров / OpenStreetMap · перетягни карту, щоб оглянути місто</p></div><button id="atlas-close" aria-label="Закрити карту">✕</button></div><canvas id="atlas-view" aria-label="Карта міста з маршрутом"></canvas><div class="atlas-bottom"><span id="atlas-note"></span><div class="atlas-tools"><button id="atlas-out" aria-label="Віддалити">−</button><button id="atlas-in" aria-label="Наблизити">+</button><button id="atlas-player">Я</button><button id="atlas-fit">Усе</button></div></div>';
  document.body.append(root);
  const canvas=$('atlas-view'),ctx=canvas.getContext('2d'),bounds=world.bounds;
  let zoom=1,cx=state.x,cz=state.z,w=0,h=0,baseScale=1;
  const pointers=new Map();let gesture=null;
  function fit(){zoom=1;cx=(bounds.minX+bounds.maxX)/2;cz=(bounds.minZ+bounds.maxZ)/2;draw();}
  function resize(){if(root.hidden)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,1.5);w=rect.width;h=rect.height;if(w<1||h<1)return;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);baseScale=Math.min(w/(bounds.maxX-bounds.minX),h/(bounds.maxZ-bounds.minZ))*.9;draw();}
  function draw(){if(root.hidden||w<1||h<1)return;const s=baseScale*zoom;ctx.clearRect(0,0,w,h);ctx.fillStyle='#122529';ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w/2,h/2);ctx.scale(s,s);ctx.translate(-cx,-cz);ctx.drawImage(mapTexture,bounds.minX,bounds.minZ,1800/mapScale,1800/mapScale);
    const route=getRoute(),mission=getMission();if(!isFree()&&route.length){ctx.lineWidth=3/s;ctx.lineJoin='round';ctx.strokeStyle='#a4e0d5';ctx.beginPath();route.forEach((p,i)=>i?ctx.lineTo(p.x,p.z):ctx.moveTo(p.x,p.z));ctx.stroke();ctx.fillStyle='#f4c97d';ctx.beginPath();ctx.arc(mission.target.x,mission.target.z,7/s,0,Math.PI*2);ctx.fill();}
    if(zoom>1.7){ctx.font=`${10/s}px system-ui`;ctx.fillStyle='#dce5df';ctx.textAlign='center';const named=new Set();for(const road of world.roads){if(!road.drive||road.name==='Вулиця без назви'||named.has(road.name))continue;const p=road.points[Math.floor(road.points.length/2)];if(Math.abs(p.x-cx)*s>w*.45||Math.abs(p.z-cz)*s>h*.45)continue;named.add(road.name);ctx.fillText(road.name,p.x,p.z-8/s);}}
    ctx.translate(state.x,state.z);ctx.rotate(-state.angle);ctx.scale(1/s,1/s);ctx.fillStyle='#fff9df';ctx.strokeStyle='#122529';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,11);ctx.lineTo(-7,-8);ctx.lineTo(0,-4);ctx.lineTo(7,-8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.font='bold 13px system-ui';ctx.fillStyle='#c8dbd7';ctx.textAlign='left';ctx.fillText('N ↑',16,25);$('atlas-note').textContent=isFree()?'Вільна поїздка':getMission().target.name;
  }
  function setZoom(value){zoom=clamp(value,1,10);draw();}
  function open(){pause(true);root.hidden=false;fit();resize();$('atlas-close').focus();}
  function close(){root.hidden=true;pointers.clear();gesture=null;pause(false);$('minimap').focus({preventScroll:true});}
  $('navigation').addEventListener('click',open);$('minimap').tabIndex=0;$('minimap').setAttribute('role','button');$('minimap').setAttribute('aria-label','Відкрити повну карту');$('minimap').title='Відкрити карту міста';
  $('minimap').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  $('atlas-close').onclick=close;$('atlas-fit').onclick=fit;$('atlas-in').onclick=()=>setZoom(zoom*1.5);$('atlas-out').onclick=()=>setZoom(zoom/1.5);$('atlas-player').onclick=()=>{cx=state.x;cz=state.z;setZoom(Math.max(zoom,3));};
  addEventListener('resize',resize);addEventListener('keydown',e=>{if(root.hidden)return;if(e.key==='Escape'){e.stopImmediatePropagation();e.preventDefault();close();}if(e.key==='Tab'){const list=[...root.querySelectorAll('button')],first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
  function beginGesture(){const ps=[...pointers.values()];gesture=ps.length>1?{span:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),zoom}:null;}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});beginGesture();});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){const s=baseScale*zoom;cx=clamp(cx-(e.clientX-old.x)/s,bounds.minX,bounds.maxX);cz=clamp(cz-(e.clientY-old.y)/s,bounds.minZ,bounds.maxZ);draw();}else{const ps=[...pointers.values()];if(gesture?.span>0)setZoom(gesture.zoom*Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)/gesture.span);}});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>{pointers.delete(e.pointerId);beginGesture();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
  const label=document.createElement('p');label.className='paint-title';label.textContent='КОЛІР АВТОМОБІЛЯ';const swatches=document.createElement('div');swatches.className='paint-swatches';swatches.setAttribute('aria-label','Колір кузова');
  const colors=[['#268c9c','Бірюзовий'],['#b64936','Червоний'],['#e1b85c','Золотистий'],['#c8d0cc','Сріблястий'],['#29343e','Графітовий'],['#47689c','Синій']];
  let paint=colors[0][0];try{const value=localStorage.getItem('game-paint');if(colors.some(([c])=>c===value))paint=value;}catch{}
  function setPaint(value){paint=value;player.paint.color.set(paint);for(const b of swatches.children)b.setAttribute('aria-pressed',String(b.dataset.paint===paint));try{localStorage.setItem('game-paint',paint);}catch{}}
  for(const [color,name] of colors){const button=document.createElement('button');button.style.setProperty('--swatch',color);button.dataset.paint=color;button.setAttribute('aria-label',name);button.title=name;button.onclick=()=>{setPaint(color);notice('Колір кузова збережено.');};swatches.append(button);}
  $('resume').before(label,swatches);setPaint(paint);
  const ribbon=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({color:'#a4e0d5',transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide}));ribbon.name='navigation-ribbon';ribbon.renderOrder=2;scene.add(ribbon);
  let previous=null,lastX=Infinity,lastZ=Infinity;
  function update(){ribbon.visible=!isFree();const route=getRoute();if(!ribbon.visible||route.length<2){ribbon.visible=false;return;}
    if(route===previous&&Math.hypot(state.x-lastX,state.z-lastZ)<4)return;previous=route;lastX=state.x;lastZ=state.z;
    let nearest=Infinity,start=1,projection=route[0];for(let i=1;i<route.length;i++){const p=nearestPoint(state,route[i-1],route[i]);if(p.distance<nearest){nearest=p.distance;start=i;projection=p;}}
    const points=[projection,...route.slice(start)],vertices=[];let length=0;
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=distance(a,b);if(d<.05)continue;const nx=(b.z-a.z)/d*.18,nz=-(b.x-a.x)/d*.18,quad=[[a.x+nx,.094,a.z+nz],[b.x+nx,.094,b.z+nz],[b.x-nx,.094,b.z-nz],[a.x-nx,.094,a.z-nz]];for(const j of [0,1,2,0,2,3])vertices.push(...quad[j]);length+=d;if(length>320)break;}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeBoundingSphere();ribbon.geometry.dispose();ribbon.geometry=geometry;
  }
  update();return{update,open,close,get openNow(){return !root.hidden;},get paint(){return paint;}};
}
