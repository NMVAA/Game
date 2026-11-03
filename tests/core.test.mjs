import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMap,project,findRoute,chooseMission,nearestNode,createState,spawnAt,stepVehicle,collisionAt,vehicleHullCollision,SpatialGrid,inside,nearestPoint,seeded} from '../src/core.mjs';
import {EYE_HEIGHT,createWalker,lookAround,placeWalker,stepWalker} from '../src/walking.mjs';
function fixture(){const elements=[],n=7;for(let j=0;j<n;j++)for(let i=0;i<n;i++)elements.push({type:'node',id:1+j*n+i,lon:34.09+i*.0017,lat:47.648+j*.0013});for(let i=0;i<n;i++){elements.push({type:'way',id:100+i,nodes:Array.from({length:n},(_,j)=>1+j*n+i),tags:{highway:'residential',name:'Тестова вертикаль'}});elements.push({type:'way',id:200+i,nodes:Array.from({length:n},(_,j)=>1+i*n+j),tags:{highway:'residential',name:'Тестова горизонталь'}});}return{elements};}
function flat(){const obstacles=new SpatialGrid(),roadGrid=new SpatialGrid();roadGrid.insert({a:{x:0,z:-5000},b:{x:0,z:5000},road:{width:100,drive:true}},-50,-5000,50,5000);return{obstacles,roadGrid,bounds:{minX:-5000,minZ:-5000,maxX:5000,maxZ:5000}};}
function wall(world){const poly=[{x:-10,z:20},{x:10,z:20},{x:10,z:25},{x:-10,z:25}],obj={poly,minX:-10,maxX:10,minZ:20,maxZ:25};world.obstacles.insert(obj,-10,20,10,25);return obj;}
test('projection uses metres and north is negative Z',()=>{const p=project(34.094,47.653);assert.ok(Math.abs(p.x)<1e-6&&Math.abs(p.z)<1e-6);assert.ok(project(34.095,47.654).x>0);assert.ok(project(34.095,47.654).z<0);});
test('corrupt or fake empty map is rejected',()=>{assert.throws(()=>parseMap(null));assert.throws(()=>parseMap({elements:[]}));});
test('OSM node-reference format is resolved into roads',()=>{const w=parseMap(fixture());assert.equal(w.roads.length,14);assert.equal(w.component.length,49);assert.ok(w.spawn.id);});
test('routes use connected roads and include endpoints',()=>{const w=parseMap(fixture()),p=findRoute(w,'1','49');assert.equal(p[0].id,'1');assert.equal(p.at(-1).id,'49');for(let i=1;i<p.length;i++)assert.ok(w.graph.get(p[i-1].id).includes(p[i].id));});
test('mission destination is reachable and not a random off-road coordinate',()=>{const w=parseMap(fixture()),m=chooseMission(w,w.spawn,5);assert.ok(m.route.length>1);assert.ok(m.length>0);assert.equal(m.target.id,m.route.at(-1).id);assert.ok(m.limit>=70);});
test('point in polygon and nearest segment account for edges',()=>{const poly=[{x:0,z:0},{x:10,z:0},{x:10,z:10},{x:0,z:10}];assert.equal(inside({x:5,z:5},poly),true);assert.equal(inside({x:15,z:5},poly),false);assert.equal(nearestPoint({x:5,z:3},{x:0,z:0},{x:10,z:0}).distance,3);});
test('grid queries deduplicate colliders and detect building edges',()=>{const w=flat(),b=wall(w);assert.equal(w.obstacles.near(0,20,100).length,1);assert.equal(collisionAt(w,{x:0,z:19},1.2),b);assert.equal(collisionAt(w,{x:0,z:10}),null);});
test('throttle accelerates and consumes fuel without teleporting',()=>{const w=flat(),s=createState();for(let i=0;i<120;i++)stepVehicle(s,{gas:true,steer:0},1/60,w);assert.ok(s.z>8&&s.z<30);assert.ok(s.speed>8);assert.ok(s.fuel<100);});
test('braking reduces forward speed, then permits reversing',()=>{const w=flat(),s=createState();s.vz=20;s.speed=20;for(let i=0;i<90;i++)stepVehicle(s,{brake:true},1/60,w);assert.ok(s.speed<1);for(let i=0;i<90;i++)stepVehicle(s,{brake:true},1/60,w);assert.ok(s.speed<-.5);});
test('steering works with stable fixed timestep and remains finite',()=>{const w=flat(),s=createState();for(let i=0;i<300;i++)stepVehicle(s,{gas:true,steer:.65},1/60,w);assert.ok(Math.abs(s.x)>1);assert.ok(Number.isFinite(s.angle));assert.ok(s.angle<0);});
test('swept collision prevents fast car tunnelling through building',()=>{const w=flat();wall(w);const s=createState();s.z=16;s.vz=39;s.speed=39;for(let i=0;i<30;i++)stepVehicle(s,{gas:true},1/60,w);assert.ok(s.z<20);assert.ok(s.health<100);assert.ok(s.hits>0);});
test('door-side collisions stop lateral clipping and apply speed-based damage',()=>{
  const w=flat(),b={minX:1.9,maxX:3.1,minZ:-.2,maxZ:.2};
  b.poly=[{x:1.9,z:-.2},{x:3.1,z:-.2},{x:3.1,z:.2},{x:1.9,z:.2}];
  w.obstacles.insert(b,b.minX,b.minZ,b.maxX,b.maxZ);
  assert.equal(vehicleHullCollision(w,{x:0,z:0},0),null);
  assert.equal(vehicleHullCollision(w,{x:.85,z:0},0),b);
  const s=createState();s.x=.65;s.vx=16;s.angle=0;
  stepVehicle(s,{},1/60,w);
  assert.equal(s.x,.65,'lateral motion must stop before the obstacle reaches the doors');
  assert.equal(s.hits,1);
  assert.ok(s.health<100,'a sideways impact must damage the car even at zero forward speed');
});
test('service brakes stop an unpowered car without accidentally engaging reverse',()=>{
  const world=flat();
  for(const failed of ['fuel','health']){
    const braking=createState({[failed]:0}),coasting=createState({[failed]:0});
    for(const state of [braking,coasting]){state.vz=19;state.speed=19;}
    for(let i=0;i<90;i++){
      stepVehicle(braking,{brake:true},1/60,world);
      stepVehicle(coasting,{},1/60,world);
    }
    assert.ok(Math.abs(braking.speed)<.01,`${failed}: brakes failed to stop the car`);
    assert.ok(coasting.speed>10,`${failed}: stopped from passive drag, not brakes`);
    for(let i=0;i<90;i++)stepVehicle(braking,{brake:true},1/60,world);
    assert.equal(braking.speed,0,`${failed}: held brake should not reverse without power`);
    const reverse=createState({[failed]:0});
    reverse.vz=-12;reverse.speed=-12;
    for(let i=0;i<90;i++)stepVehicle(reverse,{brake:true},1/60,world);
    assert.equal(reverse.speed,0,`${failed}: brakes should stop reverse roll too`);
  }
  const powered=createState();
  for(let i=0;i<90;i++)stepVehicle(powered,{brake:true},1/60,world);
  assert.ok(powered.speed<-.5,'powered brake/reverse pedal should still engage reverse');
});
test('empty fuel or broken car cannot accelerate',()=>{for(const key of ['fuel','health']){const w=flat(),s=createState({[key]:0});for(let i=0;i<120;i++)stepVehicle(s,{gas:true},1/60,w);assert.equal(s.z,0);}});
test('save migration sanitizes numbers and preserves progress',()=>{const s=createState({fuel:42,money:600,goal:3,health:999,engine:90,tires:-4,travel:'bad'});assert.equal(s.fuel,42);assert.equal(s.money,600);assert.equal(s.goal,3);assert.equal(s.health,100);assert.equal(s.engine,3);assert.equal(s.tires,0);assert.equal(s.travel,0);});
test('rescue reset preserves fuel, damage and money',()=>{const s=createState({fuel:41,health:62,money:500});spawnAt(s,{x:10,z:20,angle:1});assert.equal(s.x,10);assert.equal(s.fuel,41);assert.equal(s.health,62);assert.equal(s.money,500);});
test('seeded procedural output is reproducible',()=>{const a=seeded(3),b=seeded(3);for(let i=0;i<30;i++)assert.equal(a(),b());});

test('first-person look rotates freely but vertical pitch is constrained',()=>{
  const w=createWalker();lookAround(w,100,-100);assert.ok(w.yaw>.25&&w.pitch>.25);
  lookAround(w,0,90000);assert.ok(w.pitch>=-1.28&&w.pitch<=1.28);
  lookAround(w,0,-90000);assert.ok(w.pitch<=1.28);
  assert.equal(EYE_HEIGHT,1.68);
});
test('pedestrian movement uses camera forward/strafe and accumulates travel',()=>{
  const w=createWalker(),world=flat();for(let i=0;i<60;i++)stepWalker(w,{forward:1},1/60,world);
  assert.ok(w.z>1&&w.z<4);assert.ok(Math.abs(w.x)<.01);assert.ok(w.travel>1);
  lookAround(w,Math.PI/.0034/2,0);for(let i=0;i<60;i++)stepWalker(w,{forward:1},1/60,world);
  assert.ok(w.x>1);
});
test('pedestrian collision slides along buildings without clipping through',()=>{
  const world=flat();wall(world);const w=createWalker();
  for(let i=0;i<900;i++)stepWalker(w,{forward:1},1/60,world);
  assert.ok(w.z<19.7,w.z);assert.ok(w.z>17);
  for(let i=0;i<180;i++)stepWalker(w,{strafe:1},1/60,world);
  assert.ok(w.x>4);
});
test('sprint, stamina, jump and parked vehicle collision',()=>{
  const world=flat(),w=createWalker();
  for(let i=0;i<120;i++)stepWalker(w,{forward:1,sprint:true},1/60,world);
  assert.ok(w.z>5);assert.ok(w.stamina<80);assert.ok(w.speed>4);
  stepWalker(w,{jump:true},1/60,world);assert.ok(w.vertical>0);
  for(let i=0;i<120;i++)stepWalker(w,{},1/60,world);assert.equal(w.vertical,0);assert.ok(w.stamina>60);
  const car={x:w.x+5,z:w.z,angle:0},near=createWalker();assert.ok(placeWalker(near,car,world));
  const blocked=createWalker({x:0,z:0});for(let i=0;i<500;i++)stepWalker(blocked,{forward:1},1/60,world,{x:0,z:5});assert.ok(blocked.z<3.1);
});

test('A* chooses shortest roads over fewer junctions and handles missing or unreachable points',()=>{
  const values=[['start',0,0],['a',4,0],['b',8,0],['end',12,0],['detour',6,8]];
  const nodes=new Map(values.map(([id,x,z])=>[id,{id,x,z}]));
  const graph=new Map([['start',['detour','a']],['a',['b']],['b',['end']],['detour',['end']],['end',[]]]);
  assert.deepEqual(findRoute({nodes,graph},'start','end').map(p=>p.id),['start','a','b','end']);
  assert.deepEqual(findRoute({nodes,graph},'a','a').map(p=>p.id),['a']);
  assert.deepEqual(findRoute({nodes,graph},'missing','end'),[]);
  assert.deepEqual(findRoute({nodes,graph},'start','missing'),[]);
  assert.deepEqual(findRoute({nodes,graph},'end','start'),[]);
});
test('A* navigates a 4096-junction city graph without losing shortest paths',()=>{
  const side=64,nodes=new Map(),graph=new Map();
  for(let z=0;z<side;z++)for(let x=0;x<side;x++){
    const id=`${x},${z}`,neighbors=[];
    nodes.set(id,{id,x,z});
    if(x>0)neighbors.push(`${x-1},${z}`);
    if(z>0)neighbors.push(`${x},${z-1}`);
    if(x<side-1)neighbors.push(`${x+1},${z}`);
    if(z<side-1)neighbors.push(`${x},${z+1}`);
    graph.set(id,neighbors);
  }
  const route=findRoute({nodes,graph},'0,0',`${side-1},${side-1}`);
  assert.equal(route.length,side*2-1);
  assert.equal(route[0].id,'0,0');
  assert.equal(route.at(-1).id,`${side-1},${side-1}`);
  for(let i=1;i<route.length;i++)assert.equal(Math.abs(route[i].x-route[i-1].x)+Math.abs(route[i].z-route[i-1].z),1);
});
