/**
 * Visual-study vegetation for the neighbourhood west of Centralna 59.
 *
 * The user's satellite screenshots show a densely wooded dendropark, narrow
 * planting corridors and sparse open courtyards.  This is an INTERPRETIVE
 * density envelope anchored to known locations, NOT an extracted boundary,
 * land-ownership assertion or surveyed tree database. Building and street
 * footprints remain supplied by the separately attributed OSM dataset.
 */
import {project,seeded,inside,closestRoad,collisionAt} from './core.mjs';

export const LANDSCAPE_STUDY=Object.freeze({
  source:'User-supplied satellite visual reference, interpreted geometry',
  precision:'approximate',
  dendropark:{lat:47.6541,lon:34.1215,eastWestRadiusM:146,northSouthRadiusM:208},
  visualObjective:'Dense central green canopy; irregular courtyards; genuine OSM road and building clearances'
});
export function dendroparkWeight(p) {
  const k=LANDSCAPE_STUDY.dendropark,c=project(k.lon,k.lat);
  const dx=(p.x-c.x)/k.eastWestRadiusM,dz=(p.z-c.z)/k.northSouthRadiusM;
  const d=dx*dx+dz*dz;
  // Smooth organic edge rather than a hard, invented land parcel boundary.
  return Math.max(0,Math.min(1,(1.12-d)/.5));
}
export function visualLandcoverSites(world,options={}) {
  const seed=options.seed??13813, maxTrees=options.maxTrees??360,maxShrubs=options.maxShrubs??540;
  const rng=seeded(seed),k=LANDSCAPE_STUDY.dendropark,c=project(k.lon,k.lat);
  const trees=[],shrubs=[];
  const polygons=(world.parks||[]).filter(poly=>poly.length>=3);
  const withinMap=p=>p.x>world.bounds.minX+5&&p.x<world.bounds.maxX-5&&p.z>world.bounds.minZ+5&&p.z<world.bounds.maxZ-5;
  const free=(p,r)=>withinMap(p)&&!collisionAt(world,p,r)&&(()=>{
    const road=closestRoad(world,p,15);
    return !road||road.distance>road.road.width*.5+r+1.3;
  })();
  // A low-budget staggered grid avoids grass-like randomness and makes the
  // vegetation clump into believable blocks at phone-friendly draw counts.
  for(let z=c.z-k.northSouthRadiusM*1.14;z<=c.z+k.northSouthRadiusM*1.14;z+=10.6) {
    for(let x=c.x-k.eastWestRadiusM*1.14;x<=c.x+k.eastWestRadiusM*1.14;x+=10.6) {
      const p={x:x+(rng()-.5)*11,z:z+(rng()-.5)*11},weight=dendroparkWeight(p);
      if(weight<.12)continue;
      const mapped=polygons.some(poly=>inside(p,poly));
      const density=(mapped?.91:.68)*weight;
      if(trees.length<maxTrees&&rng()<density&&free(p,3.7)){
        trees.push({x:p.x,z:p.z,height:3.7+rng()*4.6,radius:2.2+rng()*1.9,
          kind:rng()<.16?'conifer':'broadleaf',tone:rng(),study:true});
      }else if(shrubs.length<maxShrubs&&rng()<weight*.55&&free(p,1.25)){
        shrubs.push({x:p.x,z:p.z,height:.55+rng()*.95,radius:.8+rng()*.65,tone:rng(),study:true});
      }
    }
  }
  return {trees,shrubs,metadata:{interpretive:true,treeCount:trees.length,shrubCount:shrubs.length}};
}
