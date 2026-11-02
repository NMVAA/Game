import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseMap,project,distance} from '../src/core.mjs';
import {NEIGHBORHOOD,findCentralna59,buildNeighborhoodRoute,routeProgress,startNearHouse59} from '../src/neighborhood.mjs';
function fixture(){
  const elements=[],n=8,baseLat=47.6530,baseLon=34.1175;
  const ids=Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>1+y*n+x));
  const point=(x,y)=>({lon:baseLon+x*.00128,lat:baseLat+y*.0009});
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const p=point(x,y);elements.push({type:'node',id:ids[y][x],...p});}
  for(let y=0;y<n;y++)elements.push({type:'way',id:500+y,nodes:ids[y],geometry:Array.from({length:n},(_,x)=>point(x,y)),tags:{highway:'residential',name:'Центральна'}});
  for(let x=0;x<n;x++)elements.push({type:'way',id:700+x,nodes:Array.from({length:n},(_,y)=>ids[y][x]),geometry:Array.from({length:n},(_,y)=>point(x,y)),tags:{highway:'residential',name:'Чіатурська'}});
  return {elements};
}
test('fallback for Centralna 59 is explicit approximate location, not a fake building',()=>{
  const p=findCentralna59(fixture());
  assert.equal(p.precision,'approximate');
  assert.ok(distance(p,project(NEIGHBORHOOD.home.lon,NEIGHBORHOOD.home.lat))<.001);
});
test('actual OSM address tag takes precedence over approximate street anchor',()=>{
  const data=fixture();data.elements.push({type:'node',id:999,lat:47.65355,lon:34.12514,tags:{'addr:housenumber':'59','addr:street':'вулиця Центральна'}});
  const p=findCentralna59(data);assert.equal(p.precision,'mapped');
  assert.equal(p.source,'OpenStreetMap');
  assert.ok(distance(p,project(34.12514,47.65355))<1);
});
test('a number 59 belonging to another street must not be identified as Centralna',()=>{
  const data=fixture();data.elements.push({type:'node',id:999,lat:47.65355,lon:34.12514,tags:{'addr:housenumber':'59','addr:street':'вулиця Торгова'}});
  assert.equal(findCentralna59(data).precision,'approximate');
});
test('pedestrian route follows a connected mapped graph and points towards Lyceum 6',()=>{
  const data=fixture(),world=parseMap(data),tour=buildNeighborhoodRoute(world,data);
  assert.ok(tour.route.length>5);
  assert.ok(tour.length>500&&tour.length<2400,tour.length);
  assert.ok(tour.startOffset<170);assert.ok(tour.endOffset<170);
  assert.equal(tour.home.label,'Центральна, 59');
  assert.equal(tour.school.label,'Ліцей №6');
  for(let i=1;i<tour.route.length;i++)assert.ok(distance(tour.route[i-1],tour.route[i])<180);
  const progress=routeProgress(tour.route,tour.start,0);
  assert.ok(progress.remaining>300);
  assert.ok(progress.progress>=0&&progress.progress<=1);
  assert.ok(routeProgress(tour.route,tour.end,0).remaining<.001);
});
test('route guidance identifies deviations without fabricating straight-line paths',()=>{
  const data=fixture(),tour=buildNeighborhoodRoute(parseMap(data),data);
  const off={x:tour.start.x+500,z:tour.start.z+500};
  assert.equal(routeProgress(tour.route,off).offRoute,true);
});

test('independent Visicom and municipal references keep the tour geographically grounded',()=>{
  const refs=JSON.parse(fs.readFileSync(new URL('../map/neighborhood-references.json',import.meta.url),'utf8'));
  assert.equal(refs.start.status,'address_exists_coordinate_approximate');
  const adjacent=refs.start.sources.find(p=>p.entity?.includes('61'));
  assert.ok(adjacent&&adjacent.provider==='Visicom maps');
  const fallback=project(refs.start.proposed.lon,refs.start.proposed.lat);
  assert.ok(distance(fallback,project(adjacent.lon,adjacent.lat))<140);
  const school=refs.destination.point;
  assert.ok(distance(project(school.lon,school.lat),project(NEIGHBORHOOD.school.lon,NEIGHBORHOOD.school.lat))<.01);
});
test('unnamed house 59 is not accepted as mapped Centralna 59',()=>{
  const data=fixture();data.elements.push({type:'node',id:999,lat:47.65355,lon:34.12514,tags:{'addr:housenumber':'59'}});
  assert.equal(findCentralna59(data).precision,'approximate');
});

test('start is safely beside Centralna 59, rather than at an arbitrary road node',()=>{
  const data=fixture(),world=parseMap(data),tour=buildNeighborhoodRoute(world,data);
  const spawn=startNearHouse59(world,tour);
  assert.ok(spawn.distanceToHome<=55,spawn);
  assert.ok(distance(spawn.walker,tour.home)<=55);
  assert.ok(distance(spawn.walker,spawn.car)>2.35&&distance(spawn.walker,spawn.car)<5.35,spawn);
  assert.ok(!world.obstacles.near(spawn.walker.x,spawn.walker.z,.5).some(x=>
    x.poly?.length && spawn.walker.x>=x.minX&&spawn.walker.x<=x.maxX&&spawn.walker.z>=x.minZ&&spawn.walker.z<=x.maxZ));
  assert.ok(Number.isFinite(spawn.walker.yaw));
});
test('start spot avoids mapped house footprint instead of teleporting inside a building',()=>{
  const data=fixture(),world=parseMap(data),tour=buildNeighborhoodRoute(world,data);
  const h=tour.home,block={minX:h.x-5,maxX:h.x+5,minZ:h.z-5,maxZ:h.z+5,poly:[
    {x:h.x-5,z:h.z-5},{x:h.x+5,z:h.z-5},{x:h.x+5,z:h.z+5},{x:h.x-5,z:h.z+5}
  ]};
  world.obstacles.insert(block,block.minX,block.minZ,block.maxX,block.maxZ);
  const spawn=startNearHouse59(world,tour);
  assert.ok(spawn.distanceToHome>5,spawn);
  assert.ok(spawn.distanceToHome<=55,spawn);
  assert.ok(!(spawn.walker.x>=block.minX&&spawn.walker.x<=block.maxX&&spawn.walker.z>=block.minZ&&spawn.walker.z<=block.maxZ));
});
