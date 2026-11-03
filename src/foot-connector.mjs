/** A navigable, *inferred* connector from the house-59 start vicinity
 * to the first actual mapped OSM walking route node. This avoids the previous
 * "return to route" instruction immediately upon starting the game. It never
 * asserts an official public pedestrian right-of-way or exact entrance.
 */
import {collisionAt,distance} from './core.mjs';

const key=(x,y)=>x+','+y;
const valid=(world,p,r=.52)=>{
  const b=world.bounds;
  return p.x>b.minX+r&&p.x<b.maxX-r&&p.z>b.minZ+r&&p.z<b.maxZ-r&&!collisionAt(world,p,r);
};
export function clearFootLine(world,a,b,r=.52){
  const n=Math.max(1,Math.ceil(distance(a,b)/2));
  for(let i=0;i<=n;i++){
    const t=i/n,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
    if(!valid(world,p,r))return false;
  }
  return true;
}
function push(heap,x){let i=heap.length;heap.push(x);while(i){const p=(i-1)>>1;if(heap[p].f<=x.f)break;heap[i]=heap[p];i=p;}heap[i]=x;}
function pop(heap){const top=heap[0],last=heap.pop();if(!heap.length)return top;let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;return top;}
export function connectFootRoute(world,start,mainRoute,{cell=4,padding=75,maxSearch=18000}={}){
  if(!mainRoute?.length||!valid(world,start))return null;
  const target=mainRoute[0],gap=distance(start,target);
  if(gap>390)return null;
  if(clearFootLine(world,start,target))return {points:[{...start},target],length:gap,source:'inferred-start-connector'};
  const minX=Math.min(start.x,target.x)-padding,minZ=Math.min(start.z,target.z)-padding;
  const maxX=Math.max(start.x,target.x)+padding,maxZ=Math.max(start.z,target.z)+padding;
  const nx=Math.ceil((maxX-minX)/cell)+1,nz=Math.ceil((maxZ-minZ)/cell)+1;
  if(nx*nz>maxSearch*3)return null;
  const coord=(i,j)=>({x:minX+i*cell,z:minZ+j*cell});
  const idx=p=>[Math.round((p.x-minX)/cell),Math.round((p.z-minZ)/cell)];
  const [si,sj]=idx(start),[gi,gj]=idx(target);
  const initial=key(si,sj),goal=key(gi,gj);
  const open=[],seen=new Set(),gCost=new Map([[initial,0]]),came=new Map();
  push(open,{i:si,j:sj,id:initial,f:gap});
  const moves=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,iterations=0;
  while(open.length&&iterations++<maxSearch){
    const cur=pop(open);if(seen.has(cur.id))continue;seen.add(cur.id);
    const cp=coord(cur.i,cur.j);
    if(distance(cp,target)<=cell*1.8&&clearFootLine(world,cp,target)){found=cur.id;break;}
    for(const [di,dj] of moves){
      const i=cur.i+di,j=cur.j+dj;if(i<0||j<0||i>=nx||j>=nz)continue;
      const p=coord(i,j),id=key(i,j);if(seen.has(id)||!valid(world,p))continue;
      if(!clearFootLine(world,cp,p))continue;
      const next=(gCost.get(cur.id)||0)+cell*Math.hypot(di,dj);
      if(next>=(gCost.get(id)??Infinity))continue;
      came.set(id,cur.id);gCost.set(id,next);
      push(open,{i,j,id,f:next+distance(p,target)});
    }
  }
  if(!found)return null;
  const raw=[target],path=[];for(let at=found;at;at=came.get(at)){const [i,j]=at.split(',').map(Number);path.push(coord(i,j));if(at===initial)break;}
  path.reverse();raw.unshift(...path);raw.unshift({...start});
  const out=[raw[0]];let cursor=0;
  while(cursor<raw.length-1){
    let next=cursor+1;
    for(let i=raw.length-1;i>cursor+1;i--)if(clearFootLine(world,raw[cursor],raw[i])){next=i;break;}
    out.push(raw[next]);cursor=next;
  }
  const length=out.reduce((sum,p,i)=>sum+(i?distance(out[i-1],p):0),0);
  return {points:out,length,source:'inferred-start-connector'};
}
