/** First-person pedestrian movement in world metres. No renderer dependency. */
import {clamp,finite,collisionAt,distance} from './core.mjs';
export const EYE_HEIGHT=1.68;
export const WALK_RADIUS=.34;
export function createWalker(spawn={x:0,z:0,angle:0}){
  return {x:finite(spawn.x),z:finite(spawn.z),yaw:finite(spawn.angle),pitch:0,
    vx:0,vz:0,speed:0,vertical:0,vy:0,jumpHeld:false,stamina:100,travel:0,stepPhase:0};
}
export function lookAround(w,dx,dy,sensitivity=.0034){
  w.yaw+=clamp(finite(dx),-250,250)*sensitivity;
  w.pitch=clamp(w.pitch-clamp(finite(dy),-250,250)*sensitivity,-1.28,1.28);
}
export function placeWalker(w,car,world){
  // Do not spawn inside a building, tree, or the parked vehicle.
  const rx=Math.cos(car.angle),rz=-Math.sin(car.angle);
  const offsets=[[3.4,0],[-3.4,0],[0,-4.5],[0,4.5],[5.5,0],[-5.5,0]];
  for(const [side,front] of offsets){
    const p={x:car.x+rx*side+Math.sin(car.angle)*front,z:car.z+rz*side+Math.cos(car.angle)*front};
    if(!collisionAt(world,p,WALK_RADIUS)&&(!world.bounds||p.x>=world.bounds.minX&&p.x<=world.bounds.maxX&&p.z>=world.bounds.minZ&&p.z<=world.bounds.maxZ)){
      Object.assign(w,{x:p.x,z:p.z,yaw:car.angle,pitch:0,vx:0,vz:0,speed:0,vertical:0,vy:0});return true;
    }
  }
  return false;
}
export function stepWalker(w,input,dt,world,vehicle=null){
  dt=clamp(finite(dt),0,1/30);if(!dt)return;
  let forward=clamp(finite(input.forward),-1,1),strafe=clamp(finite(input.strafe),-1,1);
  const magnitude=Math.hypot(forward,strafe);if(magnitude>1){forward/=magnitude;strafe/=magnitude;}
  const sprint=!!input.sprint&&forward>.1&&w.stamina>3;
  const targetSpeed=sprint?5.3:2.55;
  const x=(Math.sin(w.yaw)*forward+Math.cos(w.yaw)*strafe)*targetSpeed;
  const z=(Math.cos(w.yaw)*forward-Math.sin(w.yaw)*strafe)*targetSpeed;
  const blend=1-Math.exp(-(magnitude>0?12:17)*dt);
  w.vx+=(x-w.vx)*blend;w.vz+=(z-w.vz)*blend;
  w.stamina=clamp(w.stamina+(sprint?-20:12)*dt,0,100);
  // A jump is triggered by a new press, not every time the player lands.
  // Long touch presses therefore cannot cause involuntary bunny-hopping.
  const jumpPressed=!!input.jump;
  if(jumpPressed&&!w.jumpHeld&&w.vertical<=.001){w.vy=4.2;w.vertical=.001;}
  w.jumpHeld=jumpPressed;
  w.vy-=12.5*dt;w.vertical=Math.max(0,w.vertical+w.vy*dt);if(!w.vertical)w.vy=0;
  const old={x:w.x,z:w.z},dx=w.vx*dt,dz=w.vz*dt;
  const clear=p=>!collisionAt(world,p,WALK_RADIUS)&&(!vehicle||distance(p,vehicle)>=2.15);
  const b=world.bounds;
  for(let i=0,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));i<n;i++){
    const px=clamp(w.x+dx/n,b.minX+WALK_RADIUS,b.maxX-WALK_RADIUS);
    if(clear({x:px,z:w.z}))w.x=px;else w.vx=0;
    const pz=clamp(w.z+dz/n,b.minZ+WALK_RADIUS,b.maxZ-WALK_RADIUS);
    if(clear({x:w.x,z:pz}))w.z=pz;else w.vz=0;
  }
  const moved=distance(old,w);
  w.travel+=moved;w.speed=moved/dt;
  if(moved>.001)w.stepPhase+=moved*(sprint?2.8:2.45);
}
