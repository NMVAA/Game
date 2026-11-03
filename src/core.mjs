/** Deterministic game logic; no browser or Three.js dependency. Metres and seconds. */
export const VERSION = '0.4.8';
export const ORIGIN = [47.653, 34.094];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
export const lerp = (a, b, t) => a + (b - a) * t;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function seeded(seed = 12345) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
export function project(lon, lat) { return { x: (lon - ORIGIN[1]) * 111319.49 * Math.cos(ORIGIN[0] * Math.PI / 180), z: -(lat - ORIGIN[0]) * 111319.49 }; }
export function nearestPoint(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
  const t = len2 ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / len2, 0, 1) : 0;
  const x = a.x + dx * t, z = a.z + dz * t;
  return { x, z, t, distance: Math.hypot(p.x - x, p.z - z) };
}
export function inside(p, poly) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}
export class SpatialGrid {
  constructor(size = 50) { this.size = size; this.cells = new Map(); }
  insert(item, minX, minZ, maxX, maxZ) {
    for (let x = Math.floor(minX / this.size); x <= Math.floor(maxX / this.size); x++)
      for (let z = Math.floor(minZ / this.size); z <= Math.floor(maxZ / this.size); z++) {
        const key = `${x},${z}`; if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(item);
      }
  }
  near(x, z, r = 4) {
    const out = new Set();
    for (let i = Math.floor((x - r) / this.size); i <= Math.floor((x + r) / this.size); i++)
      for (let j = Math.floor((z - r) / this.size); j <= Math.floor((z + r) / this.size); j++)
        for (const item of this.cells.get(`${i},${j}`) || []) out.add(item);
    return [...out];
  }
}
const DRIVE = new Set(['trunk','primary','secondary','tertiary','unclassified','residential','living_street','service','trunk_link','primary_link','secondary_link','tertiary_link']);
export function parseMap(data) {
  if (!data || !Array.isArray(data.elements)) throw new Error('Неправильний формат геоданих.');
  const roads = [], buildings = [], parks = [], water = [], nodes = new Map(), graph = new Map();
  const roadGrid = new SpatialGrid(65), obstacles = new SpatialGrid(40);
  const rawNodes = new Map(data.elements.filter(e => e.type === 'node').map(e => [e.id, e]));
  const link = (a, b) => { if (!graph.has(a)) graph.set(a, []); if (!graph.get(a).includes(b)) graph.get(a).push(b); };
  for (const e of data.elements) {
    if (e.type !== 'way' || !e.tags) continue;
    const raw = e.geometry || (e.nodes || []).map(n => rawNodes.get(n));
    if (raw.length < 2 || raw.some(g => !g || !Number.isFinite(g.lon) || !Number.isFinite(g.lat))) continue;
    const points = raw.map(g => project(g.lon, g.lat)), t = e.tags;
    if (t.highway && t.highway !== 'construction' && t.highway !== 'proposed' && t.area !== 'yes') {
      const drive = DRIVE.has(t.highway) && t.access !== 'private' && t.access !== 'no';
      const base = ['primary','secondary','trunk'].includes(t.highway) ? 10 : ['tertiary','residential'].includes(t.highway) ? 7 : drive ? 5 : 2.2;
      const width = clamp(finite(parseFloat(t.width), base), 1.5, 22);
      const road = { id: e.id, points, width, drive, name: t['name:uk'] || t.name || 'Вулиця без назви', kind: t.highway };
      roads.push(road);
      for (let i = 1; i < points.length; i++) {
        const a = points[i-1], b = points[i]; if (distance(a,b) < .1) continue;
        const seg = { a, b, road }; roadGrid.insert(seg, Math.min(a.x,b.x)-width, Math.min(a.z,b.z)-width, Math.max(a.x,b.x)+width, Math.max(a.z,b.z)+width);
        if (drive) {
          const ak = e.nodes?.[i-1] != null ? String(e.nodes[i-1]) : `${a.x.toFixed(2)},${a.z.toFixed(2)}`;
          const bk = e.nodes?.[i] != null ? String(e.nodes[i]) : `${b.x.toFixed(2)},${b.z.toFixed(2)}`;
          nodes.set(ak, { ...a, id: ak, name: road.name }); nodes.set(bk, { ...b, id: bk, name: road.name }); link(ak,bk); link(bk,ak);
        }
      }
    } else if (t.building && t.building !== 'no' && points.length >= 4) {
      const poly = points.slice(); if (distance(poly[0],poly.at(-1)) < .01) poly.pop();
      if (poly.length < 3) continue;
      const minX = Math.min(...poly.map(p=>p.x)), maxX = Math.max(...poly.map(p=>p.x)), minZ = Math.min(...poly.map(p=>p.z)), maxZ = Math.max(...poly.map(p=>p.z));
      const rng = seeded(e.id), levels = finite(parseFloat(t['building:levels']), t.building === 'apartments' ? 5 : 2);
      const height = clamp(finite(parseFloat(t.height), levels * 3.1), 3, 85);
      const building = { poly, minX, maxX, minZ, maxZ, height, color: rng(), id: e.id };
      buildings.push(building); obstacles.insert(building,minX,minZ,maxX,maxZ);
    } else if (t.leisure === 'park' || t.landuse === 'grass' || t.natural === 'wood') parks.push(points);
    else if (t.natural === 'water') water.push(points);
  }
  if (roads.filter(r=>r.drive).length < 10 || nodes.size < 20) throw new Error('У геоданих недостатньо дорожньої мережі.');
  const seen = new Set(); let component = [];
  for (const id of nodes.keys()) {
    if (seen.has(id)) continue;
    const stack = [id], group = []; seen.add(id);
    while (stack.length) { const key = stack.pop(); group.push(key); for (const n of graph.get(key) || []) if (!seen.has(n)) { seen.add(n); stack.push(n); } }
    if (group.length > component.length) component = group;
  }
  const ids = new Set(component), all = component.map(id=>nodes.get(id));
  const spawnNode = all.reduce((a,b)=>Math.hypot(a.x,a.z)<Math.hypot(b.x,b.z)?a:b);
  const targetNode = nodes.get((graph.get(spawnNode.id) || []).find(n=>ids.has(n)));
  const spawn = { x: spawnNode.x, z: spawnNode.z, angle: Math.atan2(targetNode.x-spawnNode.x,targetNode.z-spawnNode.z), id: spawnNode.id };
  return { roads, buildings, parks, water, roadGrid, obstacles, nodes, graph, component, spawn,
    bounds: { minX: Math.min(...all.map(p=>p.x))-90, maxX: Math.max(...all.map(p=>p.x))+90, minZ: Math.min(...all.map(p=>p.z))-90, maxZ: Math.max(...all.map(p=>p.z))+90 } };
}
export function closestRoad(world, p, radius = 70) {
  let best = null;
  for (const seg of world.roadGrid.near(p.x,p.z,radius)) {
    if (!seg.road.drive) continue;
    const n = nearestPoint(p,seg.a,seg.b); if (!best || n.distance < best.distance) best = { ...n, ...seg };
  }
  return best;
}
export function nearestNode(world,p) { let best, d = Infinity; for (const id of world.component) { const v = world.nodes.get(id), n = distance(v,p); if (n < d) { best = id; d = n; } } return best; }
/** Heap-backed A* avoids scanning all frontier intersections every step. */
function routePush(heap, entry) {
  let i = heap.length; heap.push(entry);
  while (i) {
    const parent = (i - 1) >> 1;
    if (heap[parent].f <= entry.f) break;
    heap[i] = heap[parent]; i = parent;
  }
  heap[i] = entry;
}
function routePop(heap) {
  const first = heap[0], last = heap.pop();
  if (!heap.length) return first;
  let i = 0;
  while (i * 2 + 1 < heap.length) {
    let child = i * 2 + 1;
    if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++;
    if (last.f <= heap[child].f) break;
    heap[i] = heap[child]; i = child;
  }
  heap[i] = last;
  return first;
}
export function findRoute(world, start, goal) {
  const source = world.nodes.get(start), end = world.nodes.get(goal);
  if (!source || !end) return [];
  if (start === goal) return [source];
  const open = [], cost = new Map([[start, 0]]), came = new Map();
  routePush(open, { id: start, g: 0, f: distance(source, end) });
  while (open.length) {
    const current = routePop(open);
    if (current.g > cost.get(current.id)) continue; // stale heap entry
    if (current.id === goal) {
      const path = [goal];
      while (came.has(path.at(-1))) path.push(came.get(path.at(-1)));
      return path.reverse().map(id => world.nodes.get(id));
    }
    const here = world.nodes.get(current.id);
    for (const id of world.graph.get(current.id) || []) {
      const next = world.nodes.get(id);
      if (!next) continue;
      const g = current.g + distance(here, next);
      if (g >= (cost.get(id) ?? Infinity)) continue;
      cost.set(id, g); came.set(id, current.id);
      routePush(open, { id, g, f: g + distance(next, end) });
    }
  }
  return [];
}
export function chooseMission(world, position, index) {
  const start = nearestNode(world,position), rng = seeded(index*2347+81);
  let candidates = world.component.filter(id => { const d=distance(world.nodes.get(id),position);return d>260&&d<1000; });
  if (!candidates.length) candidates = world.component.filter(id=>id!==start);
  const end = candidates[Math.floor(rng()*candidates.length)];
  const route = findRoute(world,start,end); const length = route.reduce((sum,p,i)=>sum+(i?distance(p,route[i-1]):0),0);
  return { route, target: world.nodes.get(end), length, reward: Math.round(180+length*.2), limit: Math.max(70,length/7+35) };
}
export function createState(saved = {}) {
  return { x: 0, z: 0, angle: 0, vx: 0, vz: 0, steer: 0, speed: 0,
    fuel: clamp(finite(saved.fuel,100),0,100), health: clamp(finite(saved.health,100),0,100), money: Math.max(0,Math.floor(finite(saved.money,0))),
    goal: Math.max(0,Math.floor(finite(saved.goal,0))), engine: clamp(Math.floor(finite(saved.engine,0)),0,3), tires: clamp(Math.floor(finite(saved.tires,0)),0,3),
    travel: Math.max(0,finite(saved.travel,0)), hits: 0, road: true, collisionCooldown: 0 };
}
export function spawnAt(s, spawn) { Object.assign(s,{x:spawn.x,z:spawn.z,angle:spawn.angle,vx:0,vz:0,speed:0,steer:0}); }
/** Circle-vs-polygon narrow phase after spatial broad phase. */
export function collisionAt(world,p,radius=1.15) {
  for (const b of world.obstacles.near(p.x,p.z,radius)) {
    if (b.circle) { if (distance(p,b)<radius+b.radius) return b; continue; }
    if (p.x < b.minX-radius || p.x>b.maxX+radius || p.z<b.minZ-radius || p.z>b.maxZ+radius) continue;
    if (inside(p,b.poly)) return b;
    for (let i=0;i<b.poly.length;i++) if (nearestPoint(p,b.poly[i],b.poly[(i+1)%b.poly.length]).distance<radius) return b;
  }
  return null;
}
/** Overlapping disks cover the car's nose, doors and rear (metres).
 * Endpoint-only probes missed narrow obstacles along the doors.
 */
export function vehicleHullCollision(world, p, angle) {
  const fx=Math.sin(angle)*1.05, fz=Math.cos(angle)*1.05;
  return collisionAt(world,p,1.15) ||
    collisionAt(world,{x:p.x+fx,z:p.z+fz},1.15) ||
    collisionAt(world,{x:p.x-fx,z:p.z-fz},1.15);
}
export function stepVehicle(s, input, dt, world) {
  dt = clamp(finite(dt),0,1/30); if (!dt) return;
  const road = closestRoad(world,s,24); s.road = !!road && road.distance < road.road.width*.5+1;
  s.steer = lerp(s.steer,clamp(finite(input.steer),-1,1),1-Math.exp(-8*dt));
  const fx=Math.sin(s.angle),fz=Math.cos(s.angle),rx=Math.cos(s.angle),rz=-Math.sin(s.angle);
  let forward=s.vx*fx+s.vz*fz, lateral=s.vx*rx+s.vz*rz;
  const canDrive=s.fuel>0&&s.health>0;
  let acc=0;
  if (input.gas && canDrive) acc = forward < -.5 ? 15 : (8.8+s.engine*1.7)*(0.45+s.health*.0055);
  if (input.brake) {
    // Service brakes are mechanical: fuel depletion or engine damage must
    // never leave a moving vehicle unable to stop. Only a running engine
    // allows this pedal to transition to reverse from a standstill.
    if (!canDrive) forward = Math.sign(forward)*Math.max(0,Math.abs(forward)-19*dt);
    else if (forward>.5) forward = Math.max(0,forward-19*dt);
    else forward -= 5*dt;
  } else forward += acc*dt;
  const resistance = s.road ? .12 : 1.05;
  forward *= Math.exp(-(resistance+Math.abs(forward)*.004+(input.handbrake?2.3:0))*dt);
  if (!input.gas&&!input.brake&&Math.abs(forward)<.08) forward=0;
  forward = clamp(forward,-8,39+s.engine*3.5);
  const oldVX=fx*forward+rx*lateral,oldVZ=fz*forward+rz*lateral;
  const turn = s.steer * Math.atan2(forward,8) * (input.handbrake?1.6:1.05);
  s.angle -= turn*dt;
  const newFx=Math.sin(s.angle),newFz=Math.cos(s.angle);
  forward=oldVX*newFx+oldVZ*newFz;
  lateral=(oldVX*newFz-oldVZ*newFx)*Math.exp(-(input.handbrake?1.7:s.road?9+s.tires*2.5:4.5)*dt);
  s.vx = newFx*forward + newFz*lateral;
  s.vz = newFz*forward - newFx*lateral;
  const oldX=s.x,oldZ=s.z,dx=s.vx*dt,dz=s.vz*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.45));
  s.collisionCooldown=Math.max(0,s.collisionCooldown-dt);
  for (let i=0;i<steps;i++) {
    const next={x:s.x+dx/steps,z:s.z+dz/steps};
    if (vehicleHullCollision(world,next,s.angle)) {
      const impactSpeed=Math.hypot(s.vx,s.vz);
      if (!s.collisionCooldown&&impactSpeed>2) { s.health=clamp(s.health-impactSpeed*.85,0,100);s.hits++;s.collisionCooldown=.6; }
      s.vx*=-.18;s.vz*=-.18;forward*= -.18;break;
    }
    s.x=next.x;s.z=next.z;
  }
  const b=world.bounds;
  if(s.x<b.minX||s.x>b.maxX||s.z<b.minZ||s.z>b.maxZ){s.x=clamp(s.x,b.minX,b.maxX);s.z=clamp(s.z,b.minZ,b.maxZ);s.vx=0;s.vz=0;forward=0;}
  s.speed=forward;s.travel+=Math.hypot(s.x-oldX,s.z-oldZ);
  if(canDrive&&(input.gas||input.brake))s.fuel=clamp(s.fuel-(.003+Math.abs(forward)*.0009)*dt,0,100);
}
