/**
 * Hand-authored visual study for the Centralna 59 / dendropark district.
 * User-supplied satellite screenshots show the relative arrangement of
 * shops, long apartment blocks, courts and planting. These locations are
 * approximate; NO Google/Visicom tiles, traces or photographic textures
 * are shipped and the objects are NOT claimed as measured footprints.
 */
import {project} from './core.mjs';
export const PHOTO_STUDY=Object.freeze({
  anchor:{lat:47.65358,lon:34.1252,name:'Центральна, 59 (орієнтовно)'},
  provenance:'User-supplied satellite photos; manually interpreted relative layout',
  accuracy:'approximate visual reconstruction; OSM footprints take priority'
});
const E=[
  // Commercial frontage east of the green park in the supplied photos.
  ['vikonda',22,8,36,17,5.4,'retail','ВІКОНДА'],
  ['atb',86,123,56,29,6.7,'market','АТБ-МАРКЕТ'],
  ['teplo',45,-174,23,16,5.5,'retail','ТЕПЛО+'],
  ['start',-353,-287,21,13,5.2,'retail','START'],
  ['perlina',-390,-34,19,15,4.2,'retail','ПЕРЛИНА'],
  ['pharmacy',-70,172,20,12,4.4,'retail','АПТЕКА'],
  // Long residential slabs near the western side of the dendropark.
  ['res-a',-433,-248,14,52,17.5,'residential',''],
  ['res-b',-401,-206,13,59,18.8,'residential',''],
  ['res-c',-444,-139,13,60,16.8,'residential',''],
  ['res-d',-411,-75,14,53,17.8,'residential',''],
  ['res-e',-456,-9,14,57,15.7,'residential',''],
  ['res-f',-420,53,13,52,16.7,'residential',''],
  ['res-g',-465,120,15,61,18.1,'residential',''],
  ['res-h',-368,116,12,52,12.3,'residential',''],
  ['res-i',-337,-211,13,49,16.2,'residential','']
];
export const VISUAL_BUILDINGS=Object.freeze(E.map(([id,east,south,width,depth,height,kind,label])=>
  Object.freeze({id,east,south,width,depth,height,kind,label,precision:'interpretive'})));
export const PLAZA=Object.freeze({east:-146,south:-163,radius:15,precision:'interpretive'});
export function localVisualLayout(){
  const anchor=project(PHOTO_STUDY.anchor.lon,PHOTO_STUDY.anchor.lat);
  const buildings=VISUAL_BUILDINGS.map(b=>({...b,x:anchor.x+b.east,z:anchor.z+b.south}));
  return {anchor,buildings,plaza:{x:anchor.x+PLAZA.east,z:anchor.z+PLAZA.south,radius:PLAZA.radius},provenance:PHOTO_STUDY.provenance};
}
