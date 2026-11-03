import test from 'node:test';
import assert from 'node:assert/strict';
import {project,SpatialGrid} from '../src/core.mjs';
import {dendroparkWeight,visualLandcoverSites,LANDSCAPE_STUDY} from '../src/landscape.mjs';

function sampleWorld(){
  const p=project(LANDSCAPE_STUDY.dendropark.lon,LANDSCAPE_STUDY.dendropark.lat);
  return {bounds:{minX:p.x-600,maxX:p.x+600,minZ:p.z-600,maxZ:p.z+600},
    obstacles:new SpatialGrid(35),roadGrid:new SpatialGrid(65),parks:[]};
}
test('approximate satellite study is explicitly not an exact geospatial boundary',()=>{
  assert.equal(LANDSCAPE_STUDY.precision,'approximate');
  assert.match(LANDSCAPE_STUDY.source,/satellite visual reference/);
  const c=project(LANDSCAPE_STUDY.dendropark.lon,LANDSCAPE_STUDY.dendropark.lat);
  assert.ok(dendroparkWeight(c)>.99);
  assert.equal(dendroparkWeight({x:c.x+600,z:c.z}),0);
});
test('wooded zone is seeded reproducibly, with mobile-friendly hard budgets',()=>{
  const w=sampleWorld(),a=visualLandcoverSites(w,{maxTrees:25,maxShrubs:40});
  const b=visualLandcoverSites(w,{maxTrees:25,maxShrubs:40});
  assert.deepEqual(a,b);
  assert.ok(a.trees.length>0&&a.trees.length<=25);
  assert.ok(a.shrubs.length<=40);
  assert.equal(a.metadata.interpretive,true);
  for(const t of [...a.trees,...a.shrubs])assert.ok(dendroparkWeight(t)>.10);
});
test('buildings and mapped roads exclude false tree placements',()=>{
  const w=sampleWorld(),c=project(LANDSCAPE_STUDY.dendropark.lon,LANDSCAPE_STUDY.dendropark.lat);
  const block={minX:c.x-70,maxX:c.x+70,minZ:c.z-80,maxZ:c.z+80,
    poly:[{x:c.x-70,z:c.z-80},{x:c.x+70,z:c.z-80},{x:c.x+70,z:c.z+80},{x:c.x-70,z:c.z+80}]};
  w.obstacles.insert(block,block.minX,block.minZ,block.maxX,block.maxZ);
  const road={width:9,drive:true,name:'mapped road'};
  const a={x:c.x-280,z:c.z+10},b={x:c.x+280,z:c.z+10};
  w.roadGrid.insert({a,b,road},Math.min(a.x,b.x)-9,c.z,Math.max(a.x,b.x)+9,c.z+20);
  const out=visualLandcoverSites(w,{maxTrees:270,maxShrubs:250});
  for(const tree of [...out.trees,...out.shrubs]){
    assert.ok(tree.x<block.minX||tree.x>block.maxX||tree.z<block.minZ||tree.z>block.maxZ);
    assert.ok(Math.abs(tree.z-(c.z+10))>6);
  }
});
