import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalker,lookAround,placeWalker,stepWalker,walkPadAxes,EYE_HEIGHT,WALK_RADIUS} from '../src/walking.mjs';
import {SpatialGrid} from '../src/core.mjs';

function world(){
  return {
    bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},
    obstacles:new SpatialGrid(20)
  };
}
const advance=(w,input,seconds,env=world(),vehicle=null)=>{
  const dt=1/60;
  for(let i=0;i<Math.ceil(seconds/dt);i++)stepWalker(w,input,dt,env,vehicle);
};
test('mobile walking stick ignores tiny touches and preserves diagonal speed',()=>{
  const rect={left:100,top:200,width:140,height:140},cx=170,cy=270;
  const neutral={strafe:0,forward:0,thumbX:0,thumbY:0};
  assert.deepEqual(walkPadAxes(cx,cy,rect),neutral);
  assert.deepEqual(walkPadAxes(cx+4,cy-2,rect),neutral,'touch jitter must not move the player');
  const up=walkPadAxes(cx,cy-50,rect);
  assert.ok(up.forward>.99 && Math.abs(up.strafe)<.00001,'top of pad should walk forward at full speed');
  const down=walkPadAxes(cx,cy+50,rect);
  assert.ok(down.forward<-.99,'bottom of pad should walk backward');
  const half=walkPadAxes(cx+15,cy-15,rect);
  assert.ok(half.forward>0 && half.strafe>0);
  assert.ok(Math.hypot(half.forward,half.strafe)<1,'partial touches should not trigger full speed');
  const diagonal=walkPadAxes(cx+50,cy-50,rect);
  assert.ok(Math.abs(Math.hypot(diagonal.forward,diagonal.strafe)-1)<1e-9,'diagonal movement is normalized');
  assert.equal(diagonal.thumbX,-diagonal.thumbY,'visual thumb matches the axes');
});
test('walking starts at human eye height with finite camera angles',()=>{
  const w=createWalker({x:12,z:-5,angle:.4});
  assert.equal(EYE_HEIGHT,1.68);assert.equal(w.x,12);assert.equal(w.z,-5);assert.equal(w.yaw,.4);
  lookAround(w,10000,-10000);
  assert.ok(Number.isFinite(w.yaw));assert.ok(w.pitch<=1.28&&w.pitch>=-1.28);
  assert.equal(WALK_RADIUS,.34);
});
test('WASD-like forward walk and strafe move independently',()=>{
  const w=createWalker(),env=world();advance(w,{forward:1,strafe:0},2,env);
  assert.ok(w.z>3&&w.z<7);assert.ok(Math.abs(w.x)<.01);
  const z=w.z;advance(w,{forward:0,strafe:1},1,env);
  assert.ok(w.x>1);assert.ok(w.z>=z-.2);
});
test('sprinting increases travel while consuming stamina',()=>{
  const a=createWalker(),b=createWalker();const env=world();
  advance(a,{forward:1,strafe:0,sprint:false},2,env);
  advance(b,{forward:1,strafe:0,sprint:true},2,env);
  assert.ok(b.travel>a.travel*1.5);assert.ok(b.stamina<a.stamina);
  advance(b,{forward:0,strafe:0,sprint:false},2,env);
  assert.ok(b.stamina>60);
});
test('jump rises and lands without falling through ground',()=>{
  const w=createWalker(),env=world();
  advance(w,{forward:0,strafe:0,jump:true},.12,env);
  assert.ok(w.vertical>0);
  advance(w,{forward:0,strafe:0,jump:false},1,env);
  assert.equal(w.vertical,0);assert.equal(w.vy,0);
});
test('a held jump button produces one jump until released and pressed again',()=>{
  const w=createWalker(),env=world();
  assert.equal(w.jumpHeld,false);
  advance(w,{jump:true},1.5,env); // Longer than one complete jump arc.
  assert.equal(w.vertical,0,'holding jump should not bounce on landing');
  assert.equal(w.vy,0);
  advance(w,{jump:true},.25,env);
  assert.equal(w.vertical,0,'continued hold should not retrigger');
  advance(w,{jump:false},1/60,env);
  advance(w,{jump:true},.12,env);
  assert.ok(w.vertical>0,'a second press should jump normally');
});
test('walker cannot pass through building and slides against its edge',()=>{
  const w=createWalker(),env=world();
  const block={minX:-1,maxX:1,minZ:2,maxZ:4,poly:[{x:-1,z:2},{x:1,z:2},{x:1,z:4},{x:-1,z:4}]};
  env.obstacles.insert(block,-1,2,1,4);
  advance(w,{forward:1,strafe:0},3,env);
  assert.ok(w.z<2&&w.z>1);
});
test('walker stays inside playable bounds and outside parked vehicle',()=>{
  const env=world(),w=createWalker({x:0,z:0,angle:0}),car={x:0,z:0,angle:0};
  assert.equal(placeWalker(w,car,env),true);
  assert.ok(Math.hypot(w.x-car.x,w.z-car.z)>2.15);
  advance(w,{forward:0,strafe:-1},40,env,car);
  assert.ok(w.x>=env.bounds.minX&&w.x<=env.bounds.maxX);
  assert.ok(w.z>=env.bounds.minZ&&w.z<=env.bounds.maxZ);
});
