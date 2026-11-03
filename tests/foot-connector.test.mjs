import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialGrid} from '../src/core.mjs';
import {clearFootLine,connectFootRoute} from '../src/foot-connector.mjs';
function world(){return {bounds:{minX:-150,maxX:250,minZ:-150,maxZ:150},obstacles:new SpatialGrid(25),roadGrid:new SpatialGrid(65)};}
test('clear near-house start links directly to OSM pedestrian waypoints',()=>{
 const w=world(),a={x:0,z:0},end={x:100,z:0},c=connectFootRoute(w,a,[end]);
 assert.ok(c);assert.equal(c.points.length,2);assert.equal(c.length,100);
 assert.match(c.source,/inferred/);
});
test('building obstacle forces a safe connector around the footprint',()=>{
 const w=world(),poly=[{x:40,z:-10},{x:60,z:-10},{x:60,z:10},{x:40,z:10}];
 const b={poly,minX:40,maxX:60,minZ:-10,maxZ:10};w.obstacles.insert(b,40,-10,60,10);
 const a={x:0,z:0},end={x:100,z:0};
 assert.equal(clearFootLine(w,a,end),false);
 const route=connectFootRoute(w,a,[end],{cell:4,padding:45});
 assert.ok(route&&route.points.length>2);
 assert.ok(route.length>100);
 for(let i=1;i<route.points.length;i++)assert.equal(clearFootLine(w,route.points[i-1],route.points[i]),true);
});
test('unrelated distant map nodes do not create long fake connectors',()=>{
 const w=world();assert.equal(connectFootRoute(w,{x:0,z:0},[{x:400,z:0}]),null);
});
