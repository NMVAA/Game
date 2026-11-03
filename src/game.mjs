import {VERSION,clamp,lerp,finite,seeded,distance,nearestPoint,parseMap,closestRoad,nearestNode,nearestDrivableSpawn,findRoute,chooseMission,createState,spawnAt,stepVehicle,collisionAt} from './core.mjs';
import {T,setupScene,buildWorld,makeCar,makeBeacon} from './world.mjs';
import {EYE_HEIGHT,createWalker,lookAround,placeWalker,stepWalker,walkPadAxes} from './walking.mjs';
import {buildNeighborhoodRoute,routeProgress,startNearHouse59} from './neighborhood.mjs';
import {makeNeighborhoodOverlay} from './neighborhood-scene.mjs';
import {connectFootRoute} from './foot-connector.mjs';
const $=id=>document.getElementById(id), canvas=$('scene'), ui={speed:$('speed'),gear:$('gear'),fuel:$('fuel'),health:$('health'),funds:$('funds')};
const engine=setupScene(canvas),{renderer,scene,camera}=engine;
const saved=(()=>{try{return JSON.parse(localStorage.getItem('game-save-v2')||localStorage.getItem('pokrov-save-v1')||'{}');}catch{return {};}})();
const state=createState(saved),player=makeCar(),beacon=makeBeacon(scene),walker=createWalker();scene.add(player.group);
let neighborhood=null,neighborhoodView=null,tourActive=true,tourComplete=false;
const CAR_ENTRY_DISTANCE=5.4;
let inCar=false;const walkAxis={forward:0,strafe:0};let walkPointer=null,lookPointer=null,lookLastX=0,lookLastY=0;const walkHeld=new Set();
let world=null,worldView=null,paused=true,started=false,ready=false,camMode=0,night=false,mission=null,remaining=0,arrival=0,route=[],navDist=0;
let last=performance.now(),accumulator=0,time=0,hudClock=0,saveClock=0,routeClock=0,frames=0,fpsTime=0,fps=60,lowFrames=0,shake=0;
let quality='auto',pixelRatio=Math.min(devicePixelRatio,1.25),audio=null,soundOn=true,installPrompt=null,noticeTimer=0,free=false;
const keys=new Set(),held=new Map(),controls={steer:0,gas:false,brake:false,handbrake:false},traffic=[],rng=seeded(8451);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function notice(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);}
function save(){try{localStorage.setItem('game-save-v2',JSON.stringify({version:VERSION,money:state.money,goal:state.goal,fuel:state.fuel,health:state.health,engine:state.engine,tires:state.tires,travel:state.travel,walkTravel:walker.travel,walkX:walker.x,walkZ:walker.z,walkYaw:walker.yaw,tourVersion:'0.4.1',tourActive,tourComplete}));}catch{}}
function resize(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(pixelRatio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
resize();addEventListener('resize',resize);
function applyQuality(){pixelRatio=quality==='high'?Math.min(devicePixelRatio,1.75):quality==='low'?Math.min(devicePixelRatio,1):Math.min(devicePixelRatio,1.25);renderer.shadowMap.enabled=quality!=='low';engine.sun.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024);engine.sun.shadow.map?.dispose();engine.sun.shadow.map=null;resize();}
function clearInput(){steerPointer=null;walkPointer=null;lookPointer=null;keys.clear();held.clear();walkHeld.clear();Object.assign(controls,{steer:0,gas:false,brake:false,handbrake:false});walkAxis.forward=walkAxis.strafe=0;$('walkthumb').style.transform='';$('thumb').style.transform='';$('steering').setAttribute('aria-valuenow','0');document.querySelectorAll('.held').forEach(e=>e.classList.remove('held'));}
function pause(on){paused=on;clearInput();accumulator=0;if(started){$('menu').hidden=!on;$('hud').hidden=on;}if(on){save();garageUI();}if(audio)audio.gain.gain.setTargetAtTime(on?0:.035,audio.ctx.currentTime,.15);}
let steerPointer=null;
function steerAt(e){const r=$('steering').getBoundingClientRect();controls.steer=clamp((e.clientX-r.left-r.width/2)/(r.width*.34),-1,1);$('thumb').style.transform=`translateX(${controls.steer*38}px)`;$('steering').setAttribute('aria-valuenow',Math.round(controls.steer*100));}
const steer=$('steering');steer.addEventListener('pointerdown',e=>{if(paused||!inCar||steerPointer!==null)return;e.preventDefault();steerPointer=e.pointerId;steer.setPointerCapture(e.pointerId);steerAt(e);});steer.addEventListener('pointermove',e=>{if(e.pointerId===steerPointer&&!paused){e.preventDefault();steerAt(e);}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])steer.addEventListener(event,e=>{if(e.pointerId===steerPointer){steerPointer=null;controls.steer=0;$('thumb').style.transform='';steer.setAttribute('aria-valuenow','0');}});
for(const el of document.querySelectorAll('button[data-control]')){
  el.addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();el.setPointerCapture(e.pointerId);held.set(e.pointerId,el.dataset.control);el.classList.add('held');});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{e.preventDefault();held.delete(e.pointerId);if(![...held.values()].includes(el.dataset.control))el.classList.remove('held');});
}
document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-control],#scene,button'))e.preventDefault();});document.addEventListener('selectstart',e=>{if(e.target.closest('[data-control]'))e.preventDefault();});
// True first-person look: drag the world with the right thumb or a mouse.
const pad=$('walkpad');
function moveWalkPad(e){const axes=walkPadAxes(e.clientX,e.clientY,pad.getBoundingClientRect());walkAxis.strafe=axes.strafe;walkAxis.forward=axes.forward;$('walkthumb').style.transform=`translate(${axes.thumbX}px,${axes.thumbY}px)`;}
pad.addEventListener('pointerdown',e=>{if(paused||inCar||walkPointer!==null)return;e.preventDefault();walkPointer=e.pointerId;pad.setPointerCapture(e.pointerId);moveWalkPad(e);});
pad.addEventListener('pointermove',e=>{if(e.pointerId===walkPointer&&!paused){e.preventDefault();moveWalkPad(e);}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>{if(e.pointerId===walkPointer){walkPointer=null;walkAxis.forward=walkAxis.strafe=0;$('walkthumb').style.transform='';}});
canvas.addEventListener('pointerdown',e=>{if(paused||inCar||!started||lookPointer!==null)return;e.preventDefault();lookPointer=e.pointerId;lookLastX=e.clientX;lookLastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer||paused||inCar)return;e.preventDefault();lookAround(walker,e.clientX-lookLastX,e.clientY-lookLastY);lookLastX=e.clientX;lookLastY=e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(e.pointerId===lookPointer)lookPointer=null;});
for(const id of ['sprint','jump']){const b=$(id);b.addEventListener('pointerdown',e=>{if(paused||inCar)return;e.preventDefault();b.setPointerCapture(e.pointerId);walkHeld.add(id);b.classList.add('held');});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{walkHeld.delete(id);b.classList.remove('held');});}
function modeUI(){const onFoot=!inCar;document.body.classList.toggle('is-walking',onFoot);
  for(const id of ['walkcontrols','walkstatus','reticle','tourcard'])$(id).hidden=!onFoot;
  for(const id of ['controls','telemetry','wallet','camera','contract'])$(id).hidden=onFoot;
  beacon.group.visible=inCar&&!free;$('mode').value=onFoot?'walk':free?'free':'delivery';
}
function restartNeighbourhoodTour(){
  if(!neighborhood?.startSpot||!world){notice('Старт біля Центральної, 59 ще не завантажився.');return;}
  const spot=neighborhood.startSpot;
  const p=spot.walker;
  if(collisionAt(world,p,.44)){notice('Місце старту зайняте. Повтори завантаження карти.');return;}
  walker.x=p.x;walker.z=p.z;walker.yaw=p.yaw;walker.pitch=0;
  walker.vx=walker.vz=walker.vertical=walker.vy=0;walker.speed=0;
  tourActive=true;tourComplete=false;neighborhoodView?.setVisible(true);
  $('tour-free').textContent='ВІЛЬНИЙ ОГЛЯД';save();updateTourHUD();
  notice('Ти біля будинку №59 на Центральній. Іди до ліцею №6.');
}
$('tour-restart').onclick=restartNeighbourhoodTour;
$('tour-free').onclick=()=>{
  if(!neighborhood){notice('Маршрут не завантажено.');return;}
  tourActive=!tourActive;neighborhoodView?.setVisible(tourActive);
  $('tour-free').textContent=tourActive?'ВІЛЬНИЙ ОГЛЯД':'ПОКАЗАТИ МАРШРУТ';
  updateTourHUD();
};
function exitVehicle(){if(!inCar)return true;if(Math.abs(state.speed)>1.3){notice('Спочатку зупини автомобіль.');return false;}
  if(!placeWalker(walker,state,world)){notice('Немає безпечного місця, щоб вийти.');return false;}
  inCar=false;clearInput();modeUI();save();notice('Ти вийшов з автомобіля. Оглядай світ свайпом.');return true;
}
function enterVehicle({allowRecall=false}={}){
  if(inCar)return true;
  const separation=distance(walker,state),remote=separation>CAR_ENTRY_DISTANCE;
  if(remote&&!allowRecall){notice('Авто далеко. Скористайся кнопкою ШВИДКО В АВТО.');return false;}
  inCar=true;free=true;clearInput();modeUI();audioStart();save();
  notice(remote?`Швидке повернення до припаркованого авто (${Math.round(separation)} м).`:'Ти за кермом. Натисни ВИЙТИ, щоб гуляти.');
  return true;
}
function selectMode(value){if(value==='walk'){if(inCar&&!exitVehicle())$('mode').value=free?'free':'delivery';return;}
  if(!inCar&&!enterVehicle({allowRecall:true})){$('mode').value='walk';return;}free=value==='free';if(!free)reroute();modeUI();save();
}
$('enter-car').onclick=()=>enterVehicle({allowRecall:true});$('exit-car').onclick=()=>exitVehicle();
const movement=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight']);
addEventListener('keydown',e=>{if(e.target.matches('select,input'))return;if(movement.has(e.code)){if(started&&!paused){e.preventDefault();keys.add(e.code);}}if(e.repeat)return;if(e.code==='Escape'&&started)pause(!paused);if(e.code==='KeyC'&&!paused&&inCar)camMode=(camMode+1)%3;if(e.code==='KeyE'&&started&&!paused){e.preventDefault();inCar?exitVehicle():enterVehicle();}});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{if(started)pause(true);else clearInput();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)pause(true);});addEventListener('pagehide',save);
function audioStart(){if(!soundOn)return;try{if(!audio){const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),harm=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();osc.type='sawtooth';harm.type='triangle';filter.type='lowpass';filter.frequency.value=350;gain.gain.value=0;osc.connect(filter);harm.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();harm.start();audio={ctx,osc,harm,filter,gain};}audio.ctx.resume().catch(()=>{});}catch{soundOn=false;}}
function updateSound(){if(!audio)return;const t=audio.ctx.currentTime,v=inCar?Math.abs(state.speed):0,freq=34+v*3.5+(controls.gas&&inCar?15:0);audio.osc.frequency.setTargetAtTime(freq,t,.12);audio.harm.frequency.setTargetAtTime(freq*.5,t,.12);audio.filter.frequency.setTargetAtTime(220+v*14,t,.15);audio.gain.gain.setTargetAtTime(!paused&&soundOn&&inCar?.018+(controls.gas?.02:0):0,t,.12);}
$('pause').onclick=()=>{if(started)pause(!paused);};$('resume').onclick=()=>{audioStart();pause(false);};$('camera').onclick=()=>{camMode=(camMode+1)%3;notice(['Камера: переслідування','Камера: капот','Камера: зверху'][camMode]);};
$('quality').onchange=e=>{quality=e.target.value;applyQuality();};$('mode').onchange=e=>selectMode(e.target.value);
$('night').onclick=()=>{night=!night;engine.lighting(night);worldView?.setNight(night);player.lamps.forEach(l=>l.intensity=night?24:0);$('night').textContent=night?'Ніч → день':'День → ніч';};
$('sound').onclick=()=>{soundOn=!soundOn;if(soundOn)audioStart();$('sound').textContent=soundOn?'Звук: увімк.':'Звук: вимк.';updateSound();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notice('Встанови Game на головний екран для повноекранного режиму.');}catch{notice('Повноекранний режим недоступний у цьому браузері.');}};
function garageUI(){const cash=`${Math.round(state.money).toLocaleString('uk-UA')} ₴`;$('garage-money').textContent=cash;$('saveinfo').textContent=`${(state.travel/1000).toFixed(1)} км · доставок: ${state.goal} · паливо: ${Math.round(state.fuel)}%`;$('engine').textContent=state.engine>=3?'Двигун · МАКС':`Двигун ${state.engine+1}/3 · ${900+state.engine*600} ₴`;$('tires').textContent=state.tires>=3?'Шини · МАКС':`Шини ${state.tires+1}/3 · ${650+state.tires*450} ₴`;$('engine').disabled=state.engine>=3;$('tires').disabled=state.tires>=3;}
function purchase(cost,apply){if(state.money<cost){notice('Недостатньо коштів. Виконуй доставки.');return;}state.money-=cost;apply();save();garageUI();notice('Готово. Зміни збережено.');}
$('repair').onclick=()=>purchase(150,()=>state.health=100);$('refuel').onclick=()=>purchase(80,()=>state.fuel=100);$('engine').onclick=()=>{if(state.engine<3)purchase(900+state.engine*600,()=>state.engine++);};$('tires').onclick=()=>{if(state.tires<3)purchase(650+state.tires*450,()=>state.tires++);};
$('rescue').onclick=()=>{const spawn=nearestDrivableSpawn(world,state);if(!spawn){notice('Немає доступної дороги для евакуації.');return;}spawnAt(state,spawn);state.money=Math.max(0,state.money-50);state.health=Math.max(25,state.health);state.fuel=Math.max(8,state.fuel);reroute();save();garageUI();notice('Евакуація на дорогу.');};
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').hidden=false;});$('install').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('install').hidden=true;};
function reroute(){if(!world||!mission)return;route=findRoute(world,nearestNode(world,state),mission.target.id);}
function nextMission(){mission=chooseMission(world,state,state.goal);route=mission.route;remaining=mission.limit;arrival=0;beacon.group.position.set(mission.target.x,0,mission.target.z);$('mission-name').textContent=mission.target.name;$('arrival').style.width='0%';}
function makeTraffic(){const colors=['#c8b7a2','#aab7c4','#6c6f75','#ab4f3d','#bdac70','#6a8e84'];const ids=world.component.filter(id=>distance(world.nodes.get(id),state)>85);
  for(let i=0;i<Math.min(6,ids.length);i++){const a=ids[Math.floor(rng()*ids.length)],b=world.graph.get(a)?.[0];if(!b)continue;const car=makeCar(colors[i],false);scene.add(car.group);traffic.push({car,a,b,t:rng()*.5,speed:5+rng()*5,prev:null,angle:0,ready:false});}}
function tickTraffic(dt){for(const v of traffic){const a=world.nodes.get(v.a),b=world.nodes.get(v.b),len=distance(a,b);let speed=v.speed;
    if(v.ready&&distance(v.car.group.position,state)<9)speed=0;
    for(const other of traffic)if(other!==v&&v.ready&&other.ready&&distance(v.car.group.position,other.car.group.position)<5)speed=0;
    v.t+=speed*dt/Math.max(1,len);
    if(v.t>=1){const outgoing=world.graph.get(v.b)||[],opts=outgoing.filter(id=>id!==v.a),choices=opts.length?opts:outgoing;
      if(!choices.length){v.t=1;v.speed=0;continue;} // End of a one-way street: park safely, never follow an invalid edge.
      const next=choices[Math.floor(rng()*choices.length)];v.a=v.b;v.b=next;v.t=0;continue;}
    const dx=(b.x-a.x)/Math.max(len,1),dz=(b.z-a.z)/Math.max(len,1),desired=Math.atan2(dx,dz);const diff=Math.atan2(Math.sin(desired-v.angle),Math.cos(desired-v.angle));v.angle=v.ready?v.angle+diff*Math.min(1,dt*7):desired;
    v.car.group.position.set(lerp(a.x,b.x,v.t)-dz*1.5,0,lerp(a.z,b.z,v.t)+dx*1.5);v.car.group.rotation.y=v.angle;v.car.update(speed,0,dt,speed===0);v.ready=true;
  }}
const dustCount=100,dustPositions=new Float32Array(dustCount*3).fill(-999),dustLife=new Float32Array(dustCount);let dustCursor=0,dustClock=0;
const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.BufferAttribute(dustPositions,3));const dc=document.createElement('canvas');dc.width=dc.height=32;const dctx=dc.getContext('2d'),grad=dctx.createRadialGradient(16,16,0,16,16,16);grad.addColorStop(0,'#fff9');grad.addColorStop(1,'#fff0');dctx.fillStyle=grad;dctx.fillRect(0,0,32,32);
const dust=new T.Points(dustGeo,new T.PointsMaterial({map:new T.CanvasTexture(dc),color:'#d4bc92',size:2.6,transparent:true,opacity:.26,depthWrite:false}));dust.frustumCulled=false;scene.add(dust);
const skidMat=new T.MeshBasicMaterial({color:'#15181a',transparent:true,opacity:.3,depthWrite:false}),skids=new T.InstancedMesh(new T.PlaneGeometry(.19,1),skidMat,800);skids.count=0;skids.frustumCulled=false;scene.add(skids);let skidIndex=0,skidClock=0;const skidDummy=new T.Object3D();
function effects(dt){const v=Math.abs(state.speed);dustClock+=dt;skidClock+=dt;
  if(v>5&&(!state.road||controls.handbrake)&&dustClock>.06){dustClock=0;const i=dustCursor++%dustCount;dustLife[i]=1;dustPositions[i*3]=state.x-Math.sin(state.angle)*2+(rng()-.5)*2;dustPositions[i*3+1]=.25;dustPositions[i*3+2]=state.z-Math.cos(state.angle)*2;}
  for(let i=0;i<dustCount;i++)if(dustLife[i]>0){dustLife[i]-=dt*.8;dustPositions[i*3+1]+=dt*.7;if(dustLife[i]<=0)dustPositions[i*3+1]=-999;}
  dustGeo.attributes.position.needsUpdate=true;
  if(v>5&&controls.handbrake&&state.road&&skidClock>.05){skidClock=0;for(const side of [-1,1]){skidDummy.position.set(state.x-Math.sin(state.angle)*1.2+Math.cos(state.angle)*side*.88,.086,state.z-Math.cos(state.angle)*1.2-Math.sin(state.angle)*side*.88);skidDummy.rotation.set(-Math.PI/2,0,-state.angle);skidDummy.scale.set(1,Math.max(.4,v*.065),1);skidDummy.updateMatrix();skids.setMatrixAt(skidIndex++%800,skidDummy.matrix);skids.count=Math.min(800,skidIndex);}skids.instanceMatrix.needsUpdate=true;}}
const mini=$('minimap').getContext('2d'),mapTexture=document.createElement('canvas');mapTexture.width=mapTexture.height=1800;let mapScale=1;
function prepareMini(){const c=mapTexture.getContext('2d'),b=world.bounds;mapScale=1800/Math.max(b.maxX-b.minX,b.maxZ-b.minZ);c.fillStyle='#193032';c.fillRect(0,0,1800,1800);c.translate(-b.minX*mapScale,-b.minZ*mapScale);c.scale(mapScale,mapScale);c.fillStyle='#294b42';for(const p of world.parks){c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.z):c.moveTo(v.x,v.z));c.fill();}c.fillStyle='#3e5153';for(const b of world.buildings){c.beginPath();b.poly.forEach((p,i)=>i?c.lineTo(p.x,p.z):c.moveTo(p.x,p.z));c.fill();}c.strokeStyle='#7a8e89';c.lineCap='round';for(const r of world.roads){c.lineWidth=r.drive?Math.max(3,r.width):1.5;c.beginPath();r.points.forEach((p,i)=>i?c.lineTo(p.x,p.z):c.moveTo(p.x,p.z));c.stroke();}}
function drawMini(){const actor=inCar?state:walker,heading=inCar?state.angle:walker.yaw,scale=.42,b=world.bounds;mini.clearRect(0,0,320,320);mini.fillStyle='#172a2c';mini.fillRect(0,0,320,320);mini.save();mini.translate(160,160);mini.rotate(heading+Math.PI);mini.scale(scale,scale);mini.translate(-actor.x,-actor.z);mini.drawImage(mapTexture,b.minX,b.minZ,1800/mapScale,1800/mapScale);
  if(!inCar&&neighborhood&&tourActive){
    mini.strokeStyle='#a9e8d5';mini.lineWidth=4/scale;mini.lineJoin='round';
    mini.beginPath();neighborhood.route.forEach((p,i)=>i?mini.lineTo(p.x,p.z):mini.moveTo(p.x,p.z));mini.stroke();
    mini.fillStyle='#e9f8df';mini.beginPath();mini.arc(neighborhood.start.x,neighborhood.start.z,5/scale,0,Math.PI*2);mini.fill();
    mini.fillStyle='#ffd47f';mini.beginPath();mini.arc(neighborhood.end.x,neighborhood.end.z,7/scale,0,Math.PI*2);mini.fill();
  }
  if(inCar&&!free&&route.length){mini.strokeStyle='#a4e0d5';mini.lineWidth=3.3/scale;mini.lineJoin='round';mini.beginPath();route.forEach((p,i)=>i?mini.lineTo(p.x,p.z):mini.moveTo(p.x,p.z));mini.stroke();mini.fillStyle='#f4c97d';mini.beginPath();mini.arc(mission.target.x,mission.target.z,6/scale,0,Math.PI*2);mini.fill();}
  for(const v of traffic){mini.fillStyle='#aebcc1';mini.fillRect(v.car.group.position.x-2/scale,v.car.group.position.z-2/scale,4/scale,4/scale);}mini.restore();mini.fillStyle='#f4f4e8';mini.strokeStyle='#193032';mini.lineWidth=2;mini.beginPath();mini.moveTo(160,148);mini.lineTo(153,169);mini.lineTo(160,165);mini.lineTo(167,169);mini.closePath();mini.fill();mini.stroke();mini.fillStyle='#f4f4e8';mini.font='bold 14px system-ui';mini.textAlign='center';const a=heading+Math.PI;mini.fillText('N',160+Math.sin(a)*139,165-Math.cos(a)*139);
}
function nav(){let closest=Infinity,index=0,progress=0;for(let i=1;i<route.length;i++){const p=nearestPoint(state,route[i-1],route[i]);if(p.distance<closest){closest=p.distance;index=i;progress=p.t;}}navDist=0;for(let i=index;i<route.length;i++)if(i>0)navDist+=distance(route[i-1],route[i])*(i===index?1-progress:1);const aim=route[Math.min(route.length-1,index)]||mission.target;const dx=aim.x-state.x,dz=aim.z-state.z,angle=Math.atan2(dx,dz)-state.angle,relative=Math.atan2(Math.sin(angle),Math.cos(angle));$('routehint').textContent=distance(state,mission.target)<12?'Зупинись на позначці':Math.abs(relative)>2.2?'Розвернися на дорозі':relative>.45?'Тримайся праворуч':relative<-.45?'Тримайся ліворуч':'Продовжуй рух';return closest;}
function updateTourHUD(){
  if(!neighborhood){
    $('tour-name').textContent='Маршрут не готовий';
    $('tour-distance').textContent='—';$('tour-hint').textContent='Перевір геодані OpenStreetMap';
    $('tour-accuracy').textContent='Не підставляємо вигадану карту';$('tour-progress').style.width='0%';
    return;
  }
  $('tour-name').textContent='Центральна, 59 → Ліцей №6';
  const p=routeProgress(neighborhood.route,walker,walker.yaw);
  $('tour-distance').textContent=tourComplete?'ГОТОВО':Math.max(0,Math.round(p.remaining+neighborhood.endOffset))+' м';
  $('tour-hint').textContent=tourComplete?'Ти дістався ліцею №6!':tourActive?p.hint:'Вільний огляд району';
  $('tour-progress').style.width=Math.round((tourComplete?1:p.progress)*100)+'%';
  const d=neighborhood.startSpot?.distanceToHome;
  $('tour-accuracy').textContent=(neighborhood.home.precision==='mapped'?'№59 з OpenStreetMap':'№59 — орієнтовна адреса')+(Number.isFinite(d)?' · старт приблизно за '+Math.round(d)+' м':'')+'; не точний вхід.';
}
function updateHud(){if(!inCar){const road=closestRoad(world,walker,60);$('walkstreet').textContent=road?.distance<30?road.road.name:'Вільна прогулянка';$('walkdistance').textContent=Math.round(walker.travel)+' м';$('walkpace').textContent=walker.speed>3.25?'Біг':'Ходьба';$('stamina').value=walker.stamina;const metres=distance(walker,state),d=Math.round(metres);$('enter-car').textContent=metres<=CAR_ENTRY_DISTANCE?'СІСТИ В АВТО':'ШВИДКО В АВТО · '+d+' м';updateTourHUD();drawMini();return;}const kph=Math.round(Math.abs(state.speed)*3.6);ui.speed.textContent=kph;ui.gear.textContent=state.speed<-.4?'R':kph<2?'N':Math.min(6,1+Math.floor(kph/28));ui.fuel.value=state.fuel;ui.health.value=state.health;ui.funds.textContent=Math.round(state.money).toLocaleString('uk-UA')+' ₴';$('fps').textContent=`${Math.round(fps)} FPS`;
  const road=closestRoad(world,state,85);$('street').textContent=road?.distance<30?road.road.name:'Поза дорогою';if(free){$('mission-name').textContent='Вільна поїздка';$('distance').textContent=(state.travel/1000).toFixed(1)+' км';$('countdown').textContent='';$('routehint').textContent='Досліджуй місто';$('arrival').style.width='0%';}else{nav();$('mission-name').textContent=mission.target.name;$('distance').textContent=navDist>999?(navDist/1000).toFixed(1)+' км':Math.round(navDist)+' м';$('countdown').textContent=remaining>0?`${Math.floor(remaining/60)}:${String(Math.floor(remaining%60)).padStart(2,'0')}`:'БЕЗ БОНУСУ';$('arrival').style.width=`${Math.min(100,arrival*100)}%`;}drawMini();}
function fixedStep(dt){if(!inCar){const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),strafe=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);const old={x:walker.x,z:walker.z};stepWalker(walker,{forward:clamp(forward+walkAxis.forward,-1,1),strafe:clamp(strafe+walkAxis.strafe,-1,1),sprint:walkHeld.has('sprint')||keys.has('ShiftLeft')||keys.has('ShiftRight'),jump:walkHeld.has('jump')||keys.has('Space')},dt,world,state);
  if(neighborhood&&tourActive&&!tourComplete&&distance(walker,neighborhood.end)<11){
    tourComplete=true;state.money+=240;save();notice('Маршрут до ліцею №6 завершено! +240 ₴');
  }
  tickTraffic(dt);for(const v of traffic)if(v.ready&&distance(walker,v.car.group.position)<1.5){walker.x=old.x;walker.z=old.z;walker.speed=0;}saveClock+=dt;if(saveClock>5){saveClock=0;save();}return;}controls.gas=[...held.values()].includes('gas')||keys.has('KeyW')||keys.has('ArrowUp');controls.brake=[...held.values()].includes('brake')||keys.has('KeyS')||keys.has('ArrowDown');controls.handbrake=[...held.values()].includes('handbrake')||keys.has('Space');const steerKey=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const old={x:state.x,z:state.z,hits:state.hits};stepVehicle(state,{...controls,steer:steerPointer===null?steerKey:controls.steer},dt,world);tickTraffic(dt);
  for(const v of traffic)if(v.ready&&distance(v.car.group.position,state)<2.65){state.x=old.x;state.z=old.z;const impact=Math.abs(state.speed);state.vx*= -.15;state.vz*= -.15;state.speed*= -.15;if(!state.collisionCooldown&&impact>2){state.health=Math.max(0,state.health-impact*.6);state.hits++;state.collisionCooldown=.8;}}
  if(state.hits>old.hits){shake=.35;if(state.health<15)notice('Кузов пошкоджено. Ремонт доступний у гаражі.');}
  player.group.position.set(state.x,0,state.z);player.group.rotation.y=state.angle;player.update(state.speed,state.steer,dt,controls.brake);effects(dt);shake=Math.max(0,shake-dt);
  if(!free){remaining=Math.max(0,remaining-dt);if(distance(state,mission.target)<8&&Math.abs(state.speed)<2.2){arrival+=dt;if(arrival>=1){const reward=mission.reward+(remaining>0?100:0);state.money+=reward;state.goal++;notice(`Доставлено! +${reward} ₴`);nextMission();save();}}else arrival=0;}
  routeClock+=dt;if(routeClock>4){routeClock=0;if(!free&&nav()>28)reroute();}saveClock+=dt;if(saveClock>5){saveClock=0;save();}
}
const cameraDesired=new T.Vector3(),look=new T.Vector3();
function updateCamera(dt){if(started&&!inCar){const bob=walker.speed>.1?Math.sin(walker.stepPhase*2)*Math.min(.044,walker.speed*.009):0;const eye=EYE_HEIGHT+walker.vertical+bob,cp=Math.cos(walker.pitch);camera.position.set(walker.x,eye,walker.z);look.set(walker.x+Math.sin(walker.yaw)*cp*20,eye+Math.sin(walker.pitch)*20,walker.z+Math.cos(walker.yaw)*cp*20);camera.lookAt(look);const fov=walker.speed>3.5?75:72;if(Math.abs(camera.fov-fov)>.12){camera.fov=lerp(camera.fov,fov,.15);camera.updateProjectionMatrix();}player.group.visible=true;engine.followSun(walker);return;}const dir=new T.Vector3(Math.sin(state.angle),0,Math.cos(state.angle)),pos=player.group.position;
  if(!started){cameraDesired.set(pos.x-20,27,pos.z-29);look.copy(pos).add(new T.Vector3(0,1,0));}
  else if(camMode===1){cameraDesired.copy(pos).addScaledVector(dir,1.15);cameraDesired.y=1.64;look.copy(pos).addScaledVector(dir,25);look.y=1.4;}
  else if(camMode===2){cameraDesired.copy(pos).addScaledVector(dir,-6);cameraDesired.y=54;look.copy(pos);}
  else{cameraDesired.copy(pos).addScaledVector(dir,-(9+Math.abs(state.speed)*.08));cameraDesired.y=4.2+Math.abs(state.speed)*.022;look.copy(pos).addScaledVector(dir,7);look.y=1.1;
    if(world){const hit=collisionAt(world,{x:cameraDesired.x,z:cameraDesired.z},.6);if(hit&&!hit.circle)cameraDesired.y=Math.min(35,hit.height+4);}}
  camera.position.lerp(cameraDesired,1-Math.exp(-dt*(camMode===1?24:6)));if(shake&&!reduced){camera.position.x+=(rng()-.5)*shake*.35;camera.position.y+=(rng()-.5)*shake*.2;}camera.lookAt(look);const fov=camMode===1?69:58+Math.min(8,Math.abs(state.speed)*.15);if(Math.abs(camera.fov-fov)>.1){camera.fov=lerp(camera.fov,fov,.05);camera.updateProjectionMatrix();}player.group.visible=camMode!==1;engine.followSun(state);}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;time+=dt;
  if(ready&&!paused){accumulator+=dt;while(accumulator>=1/60){fixedStep(1/60);accumulator-=1/60;}hudClock+=dt;if(hudClock>.2){hudClock=0;updateHud();}updateSound();}else{accumulator=0;updateSound();}
  if(ready){updateCamera(dt);beacon.update(time);neighborhoodView?.update(time,camera);}renderer.render(scene,camera);
  frames++;fpsTime+=dt;if(fpsTime>=2){fps=frames/fpsTime;frames=0;fpsTime=0;if(quality==='auto'&&started&&!paused){lowFrames=fps<27?lowFrames+1:0;if(lowFrames>=3){pixelRatio=Math.max(.8,pixelRatio-.2);renderer.shadowMap.enabled=false;resize();lowFrames=0;}}}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause(true);notice('Графічний контекст втрачено. Перезавантаж сторінку.');});
async function load(){ready=false;$('start').disabled=true;$('retry').hidden=true;$('loadstatus').textContent='Завантажуємо реальну карту Покрова…';$('loadbar').style.width='15%';
  try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let data;try{const r=await fetch('./map/pokrov.json',{signal:controller.signal});if(!r.ok)throw new Error(`Карта недоступна (${r.status}).`);data=await r.json();}finally{clearTimeout(timer);}
    world=parseMap(data);
    try{neighborhood=buildNeighborhoodRoute(world,data);}catch(err){console.warn('Neighbourhood tour unavailable:',err);neighborhood=null;}
    $('loadstatus').textContent='Створюємо дороги, будівлі та зелені зони…';
    worldView=await buildWorld(scene,world,p=>$('loadbar').style.width=`${25+p*70}%`);
    // The route overlay is placed after the safe spawn is resolved below.
    tourActive=true;
    tourComplete=false;
    neighborhoodView?.setVisible(tourActive);
    if(neighborhood){
      const spot=startNearHouse59(world,neighborhood);
      neighborhood.startSpot=spot;
      const connector=connectFootRoute(world,spot.walker,neighborhood.route);
      if(connector){
        neighborhood.connector=connector;
        neighborhood.originalStartOffset=neighborhood.startOffset;
        neighborhood.route=[...connector.points.slice(0,-1),...neighborhood.route];
        neighborhood.start=neighborhood.route[0];
        neighborhood.length+=connector.length;
        neighborhood.startOffset=0;
      }
      spawnAt(state,spot.car);
    }else spawnAt(state,world.spawn);
    neighborhoodView=makeNeighborhoodOverlay(scene,world,neighborhood,data);
    neighborhoodView?.setVisible(tourActive);
    if(collisionAt(world,state,2)){const id=world.component.find(id=>!collisionAt(world,world.nodes.get(id),2));if(id){const p=world.nodes.get(id),n=world.nodes.get(world.graph.get(id)[0]);spawnAt(state,{...p,angle:Math.atan2(n.x-p.x,n.z-p.z)});}}
    player.group.position.set(state.x,0,state.z);player.group.rotation.y=state.angle;
    if(neighborhood?.startSpot){
      Object.assign(walker,{x:neighborhood.startSpot.walker.x,z:neighborhood.startSpot.walker.z,yaw:neighborhood.startSpot.walker.yaw,pitch:0,vx:0,vz:0,speed:0,vertical:0,vy:0});
    }else placeWalker(walker,state,world);
    // Always begin a fresh game beside house 59, even if the previous version
    // saved the player elsewhere; keep cumulative distance and rewards.
    walker.travel=Math.max(0,finite(saved.walkTravel,0));
    nextMission();makeTraffic();prepareMini();camera.position.set(walker.x,EYE_HEIGHT,walker.z);modeUI();ready=true;
    const meta=`${world.roads.length} доріг · ${world.buildings.length} будівель`;$('loadstatus').textContent=`Місто готове. ${meta}.`;$('mapdetails').textContent=`Карта: Покров, OpenStreetMap. ${meta}. Район Центральної, 59 та ліцею №6. Контури будівель — OSM; дахи та озеленення дендропарку — художня реконструкція за супутниковими орієнтирами, не геодезична зйомка. Версія ${VERSION}.`;$('mapstate').textContent=neighborhood?'ЦЕНТРАЛЬНА 59 → ЛІЦЕЙ 6':'ПОКРОВ / OSM';$('loadbar').style.width='100%';$('start').disabled=false;$('start').textContent=neighborhood?'ПОЧАТИ МАРШРУТ →':'ПОЧАТИ ПРОГУЛЯНКУ →';
  }catch(error){console.error(error);$('loadstatus').textContent=error.name==='AbortError'?'Сервер карти не відповів. Повтори завантаження.':error.message+' Вигадану карту не підставлено.';$('retry').hidden=false;$('start').textContent='КАРТА НЕ ГОТОВА';$('mapstate').textContent='ПОМИЛКА КАРТИ';}}
$('retry').onclick=()=>location.reload();$('start').onclick=()=>{if(!ready)return;started=true;paused=false;$('boot').hidden=true;$('hud').hidden=false;audioStart();clearInput();updateHud();};
if('serviceWorker'in navigator&&isSecureContext){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{reg.update().catch(()=>{});if(reg.waiting)notice('Є нова версія. Перезавантаж Game.');}).catch(e=>console.warn('PWA cache unavailable',e));}
if(new URLSearchParams(location.search).has('test'))window.__GAME_TEST__={get ready(){return ready;},get paused(){return paused;},get state(){return {...state};},get walker(){return {...walker};},get inCar(){return inCar;},get render(){return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},get map(){return world?{roads:world.roads.length,buildings:world.buildings.length,nodes:world.component.length}:null;},get landscape(){return worldView?.landscape??null;},get tour(){return neighborhood?{length:neighborhood.length,startOffset:neighborhood.startOffset,endOffset:neighborhood.endOffset,connectorLength:neighborhood.connector?.length??0,points:neighborhood.route.length,precision:neighborhood.home.precision,type:neighborhood.routeType,spawnDistance:neighborhood.startSpot?.distanceToHome,spawnSource:neighborhood.startSpot?.source,home:neighborhood.home}:null;}};
requestAnimationFrame(frame);load();
