import test from 'node:test';
import assert from 'node:assert/strict';
import {project,distance} from '../src/core.mjs';
import {PHOTO_STUDY,VISUAL_BUILDINGS,localVisualLayout} from '../src/local-layout.mjs';
test('photographic layout is explicitly labelled illustrative and never surveyed',()=>{
 assert.equal(PHOTO_STUDY.accuracy,'approximate visual reconstruction; OSM footprints take priority');
 assert.match(PHOTO_STUDY.provenance,/User-supplied satellite/);
 const data=localVisualLayout();
 assert.equal(data.buildings.length,VISUAL_BUILDINGS.length);
 const home=project(PHOTO_STUDY.anchor.lon,PHOTO_STUDY.anchor.lat);
 assert.ok(distance(home,data.anchor)<.001);
});
test('nearby market frontage and park are located relative to Centralna 59 without a false exact entrance',()=>{
 const data=localVisualLayout(),home=data.anchor,vikonda=data.buildings.find(b=>b.id==='vikonda');
 const market=data.buildings.find(b=>b.id==='atb'),start=data.buildings.find(b=>b.id==='start');
 assert.ok(vikonda&&market&&start);
 assert.ok(distance(vikonda,home)>15&&distance(vikonda,home)<55);
 assert.ok(market.x>home.x&&market.z>home.z);
 assert.ok(start.x<home.x&&start.z<home.z);
 assert.ok(data.plaza.x<home.x);
});
test('distinct finite and proportioned buildings do not occupy the home reference itself',()=>{
 const l=localVisualLayout(),ids=new Set();
 for(const b of l.buildings){
   assert.ok(!ids.has(b.id));ids.add(b.id);
   for(const v of [b.x,b.z,b.width,b.depth,b.height])assert.ok(Number.isFinite(v));
   assert.ok(b.width>5&&b.depth>5&&b.height>=3);
   assert.ok(distance(b,l.anchor)>Math.min(b.width,b.depth)/2);
 }
});
