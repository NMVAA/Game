/**
 * Centralna 59 -> Lyceum 6 neighbourhood walking route in Pokrov.
 * Road/footway geometry comes from OSM. The house 59 fallback is an
 * approximate street-side reference derived from neighbouring mapped addresses,
 * NEVER a claim of an exact house coordinate or entrance.
 */
import {project,distance,nearestPoint,findRoute,nearestNode,clamp,collisionAt} from './core.mjs';

export const NEIGHBORHOOD={
  id:'centralna59-lyceum6',
  home:{lat:47.65358,lon:34.12520,label:'Центральна, 59',precision:'approximate'},
  school:{lat:47.65794101800691,lon:34.11834237593813,label:'Ліцей №6',address:'Чіатурська, 6',precision:'verified'}
};
const WALKABLE=new Set(['residential','living_street','service','unclassified','tertiary','secondary','primary','footway','path','pedestrian','steps','crossing','cycleway','track','sidewalk']);
const norm=v=>String(v||'').toLocaleLowerCase('uk-UA').replace(/[^а-яіїєґa-z0-9]/gu,'');
const isCentralna=name=>/централ|калінін|central|tsentral|kalinin/.test(norm(name));
const center=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length});
export function findCentralna59(data){
  const fallback={...project(NEIGHBORHOOD.home.lon,NEIGHBORHOOD.home.lat),label:NEIGHBORHOOD.home.label,precision:'approximate',source:'Neighbouring address reference'};
  const candidates=[];
  for(const e of data.elements||[]){
    const t=e.tags||{},n=String(t['addr:housenumber']||'').trim();
    if(!/^59(?:\s|$)/.test(n))continue;
    // A building #59 with no named street could belong to another road.
    // Require an explicit, matching street name before calling its position mapped.
    if(!t['addr:street']||!isCentralna(t['addr:street']))continue;
    const points=e.geometry?.length?e.geometry.map(p=>project(p.lon,p.lat)):Number.isFinite(e.lat)&&Number.isFinite(e.lon)?[project(e.lon,e.lat)]:[];
    if(!points.length)continue;
    const loc=center(points),d=distance(loc,fallback);
    if(d<480)candidates.push({x:loc.x,z:loc.z,precision:'mapped',source:'OpenStreetMap',label:NEIGHBORHOOD.home.label,d});
  }
  candidates.sort((a,b)=>a.d-b.d);
  return candidates[0]||fallback;
}
function heapPush(heap,item){heap.push(item);let i=heap.length-1;while(i){let p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p;}heap[i]=item;}
function heapPop(heap){const result=heap[0],last=heap.pop();if(!heap.length)return result;let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;return result;}
function walkingNetwork(data){
  const nodes=new Map(),edges=new Map();
  const connect=(a,b,kind,name)=>{
    const p=nodes.get(a),q=nodes.get(b);if(!p||!q)return;
    const metres=distance(p,q);if(metres<.05)return;
    for(const [u,v] of [[a,b],[b,a]]){
      if(!edges.has(u))edges.set(u,[]);
      edges.get(u).push({id:v,cost:metres*(kind==='primary'||kind==='secondary'?1.3:1),name});
    }
  };
  for(const e of data.elements||[]){
    const t=e.tags||{};
    if(e.type!=='way'||!WALKABLE.has(t.highway)||t.access==='private'||t.access==='no'||t.foot==='no'||t.area==='yes')continue;
    const coords=e.geometry;
    if(!coords?.length||coords.length<2)continue;
    const ids=coords.map((p,i)=>e.nodes?.[i]!=null?String(e.nodes[i]):`geo:${p.lon.toFixed(6)},${p.lat.toFixed(6)}`);
    coords.forEach((geo,i)=>{const p=project(geo.lon,geo.lat);if(!nodes.has(ids[i]))nodes.set(ids[i],{...p,id:ids[i],name:t['name:uk']||t.name||''});});
    for(let i=1;i<ids.length;i++)connect(ids[i-1],ids[i],t.highway,t['name:uk']||t.name||'');
  }
  return {nodes,edges};
}
function components(net){
  const seen=new Set(),out=[];
  for(const id of net.nodes.keys()){
    if(seen.has(id)||!net.edges.has(id))continue;
    const stack=[id],ids=[];seen.add(id);
    while(stack.length){const v=stack.pop();ids.push(v);for(const item of net.edges.get(v)||[])if(!seen.has(item.id)){seen.add(item.id);stack.push(item.id);}}
    if(ids.length>=3)out.push(ids);
  }
  return out;
}
function endpoints(component,net,home,school){
  let start=null,end=null,da=Infinity,db=Infinity;
  for(const id of component){
    const p=net.nodes.get(id),a=distance(p,home),b=distance(p,school);
    if(a<da){da=a;start=id;}if(b<db){db=b;end=id;}
  }
  return {start,end,da,db,score:da+db};
}
function aStar(net,from,to){
  const end=net.nodes.get(to),cost=new Map([[from,0]]),prev=new Map(),open=[],closed=new Set();
  heapPush(open,{id:from,f:distance(net.nodes.get(from),end)});
  while(open.length){
    const {id}=heapPop(open);if(closed.has(id))continue;
    if(id===to){const ids=[id];while(prev.has(ids.at(-1)))ids.push(prev.get(ids.at(-1)));return ids.reverse().map(k=>net.nodes.get(k));}
    closed.add(id);
    for(const item of net.edges.get(id)||[]){
      const candidate=cost.get(id)+item.cost;
      if(candidate<(cost.get(item.id)??Infinity)){
        prev.set(item.id,id);cost.set(item.id,candidate);
        heapPush(open,{id:item.id,f:candidate+distance(net.nodes.get(item.id),end)});
      }
    }
  }
  return [];
}
export function buildNeighborhoodRoute(world,data){
  const home=findCentralna59(data),school={...project(NEIGHBORHOOD.school.lon,NEIGHBORHOOD.school.lat),label:NEIGHBORHOOD.school.label,precision:'verified'};
  const net=walkingNetwork(data),possible=components(net).map(ids=>({ids,...endpoints(ids,net,home,school)})).filter(x=>x.start&&x.end);
  possible.sort((a,b)=>a.score-b.score);
  let route=[],routeType='footways',snaps=null;
  for(const choice of possible.slice(0,10)){
    if(choice.da>240||choice.db>250||choice.start===choice.end)continue;
    const candidate=aStar(net,choice.start,choice.end);
    if(candidate.length>=2){route=candidate;snaps=choice;break;}
  }
  if(route.length<2){
    const a=nearestNode(world,home),b=nearestNode(world,school);
    route=findRoute(world,a,b);routeType='mapped-roads';
    snaps={da:route.length?distance(home,route[0]):Infinity,db:route.length?distance(school,route.at(-1)):Infinity};
  }
  if(route.length<2||snaps.da>300||snaps.db>300)throw new Error('Немає зв’язного пішохідного маршруту між Центральною, 59 та ліцеєм №6 в OSM.');
  const length=route.reduce((s,p,i)=>s+(i?distance(route[i-1],p):0),0);
  const streets=[...new Set(route.map(p=>p.name).filter(s=>s&&!/без назви/i.test(s)))];
  return {id:NEIGHBORHOOD.id,home,school,route,length,routeType,start:route[0],end:route.at(-1),startOffset:snaps.da,endOffset:snaps.db,streets};
}
/** Pick a spawn beside house 59, never simply at the first routing node.
 * Validates building/tree collision, street position and parked-car clearance.
 * OSM can lack house entrances: the address anchor remains approximate.
 */
export function startNearHouse59(world,tour){
  if(!world||!tour?.home)throw new Error('Потрібна карта та адресний орієнтир Центральна, 59.');
  const home=tour.home,bounds=world.bounds,insideBounds=p=>!bounds||
    p.x>bounds.minX+.7&&p.x<bounds.maxX-.7&&p.z>bounds.minZ+.7&&p.z<bounds.maxZ-.7;
  const safe=(p,r)=>insideBounds(p)&&!collisionAt(world,p,r);
  const roadSegments=world.roadGrid.near(home.x,home.z,90)
    .filter(s=>s.road.drive).map(s=>({...s,near:nearestPoint(home,s.a,s.b)}))
    .filter(s=>s.near.distance<85).sort((a,b)=>a.near.distance-b.near.distance).slice(0,100);
  const candidates=[];
  let nearestRoadsideCar=null;
  for(const seg of roadSegments){
    const length=distance(seg.a,seg.b);
    if(length<.5)continue;
    const dx=(seg.b.x-seg.a.x)/length,dz=(seg.b.z-seg.a.z)/length;
    const nx=dz,nz=-dx,heading=Math.atan2(dx,dz);
    for(const along of [0,2.5,-2.5,5,-5,9,-9]){
      const car={x:seg.near.x+dx*along,z:seg.near.z+dz*along,angle:heading};
      if(!safe(car,2)||!safe({x:car.x+dx*1.65,z:car.z+dz*1.65},.9)||
         !safe({x:car.x-dx*1.65,z:car.z-dz*1.65},.9))continue;
      const carDistance=distance(car,home);
      if(!nearestRoadsideCar||carDistance<nearestRoadsideCar.distance)nearestRoadsideCar={car,distance:carDistance};
      for(const side of [1,-1])for(const lateral of [3.1,3.8,4.5,5.1]){
        for(const forward of [0,1,-1]){
          const walker={x:car.x+nx*lateral*side+dx*forward,z:car.z+nz*lateral*side+dz*forward};
          if(!safe(walker,.44))continue;
          const fromCar=distance(walker,car);
          if(fromCar<2.35||fromCar>5.35)continue;
          const homeDistance=distance(walker,home);
          candidates.push({walker,car,distanceToHome:homeDistance,score:homeDistance+seg.near.distance*.04+Math.abs(fromCar-3.65)*.2,source:'mapped-road'});
        }
      }
    }
    // Avoid enumerating the whole city: only nearby mapped streets are relevant.
    if(candidates.length>1200)break;
  }
  candidates.sort((a,b)=>a.score-b.score);
  let best=candidates[0];
  if(!best||best.distanceToHome>45){
    // A courtyard without a mapped driveway can still contain a safe public
    // starting location; never invent a traversable path through buildings.
    let open=null;
    for(const radius of [2,4,6,8,11,15,20,27,35,45]){
      for(let i=0;i<24;i++){
        const a=i*Math.PI/12,p={x:home.x+Math.cos(a)*radius,z:home.z+Math.sin(a)*radius};
        if(!safe(p,.45))continue;
        const score=radius+Math.max(0,(roadSegments[0]?.near.distance||0)-25)*.04;
        if(!open||score<open.score)open={walker:p,score,distanceToHome:radius};
      }
      if(open&&open.distanceToHome<=15)break;
    }
    if(open&&(!best||open.distanceToHome<best.distanceToHome)){
      // The nearest safe roadside parking may be beyond walking interaction range.
      // Preserve the safe address spawn; the UI offers an explicit car return.
      const car=nearestRoadsideCar?.car||best?.car||{x:tour.start.x,z:tour.start.z,angle:Math.atan2(tour.route[1].x-tour.start.x,tour.route[1].z-tour.start.z)};
      best={...open,car,source:'safe-address-vicinity'};
    }
  }
  if(!best||best.distanceToHome>55)
    throw new Error('Не знайдено безпечного старту біля Центральної, 59 у межах 55 метрів.');
  const aim=distance(best.walker,tour.start)>3?tour.start:tour.route[1];
  best.walker.yaw=Math.atan2(aim.x-best.walker.x,aim.z-best.walker.z);
  best.nearHouse=best.distanceToHome<=55;
  return best;
}

export function routeProgress(route,position,heading=0){
  if(!route?.length)return {remaining:0,progress:0,hint:'Маршрут не завантажено',offRoute:true};
  let closest={distance:Infinity,index:1,t:0,x:route[0].x,z:route[0].z};
  for(let i=1;i<route.length;i++){
    const p=nearestPoint(position,route[i-1],route[i]);
    if(p.distance<closest.distance)closest={distance:p.distance,index:i,t:p.t,x:p.x,z:p.z};
  }
  let remaining=0,total=0;
  for(let i=1;i<route.length;i++){
    const d=distance(route[i-1],route[i]);total+=d;
    if(i===closest.index)remaining+=d*(1-closest.t);
    else if(i>closest.index)remaining+=d;
  }
  // Aim eight metres ahead *along the mapped route*. Looking one whole
  // waypoint past the current street can give a wrong turn at long segments.
  let aim=route[closest.index]||route.at(-1);
  let anchor={x:closest.x,z:closest.z},ahead=8;
  for(let i=closest.index;i<route.length;i++){
    const next=route[i],length=distance(anchor,next);
    if(length>=ahead&&length>0){
      const t=ahead/length;
      aim={x:anchor.x+(next.x-anchor.x)*t,z:anchor.z+(next.z-anchor.z)*t};
      break;
    }
    ahead-=length;aim=next;anchor=next;
  }
  const angle=Math.atan2(aim.x-position.x,aim.z-position.z)-heading;
  const relative=Math.atan2(Math.sin(angle),Math.cos(angle));
  // Positive yaw points towards +X (right) in this world's coordinate system.
  const hint=closest.distance>35?'Повернись до маршруту':Math.abs(relative)>2.3?'Розвернися':relative>.50?'Поверни праворуч':relative<-.50?'Поверни ліворуч':'Продовжуй прямо';
  return {remaining,progress:clamp(total?(total-remaining)/total:1,0,1),offRoute:closest.distance>35,nearestDistance:closest.distance,hint};
}
