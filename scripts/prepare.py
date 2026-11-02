"""Build a self-contained Pages artifact. Never replace real map data with a mock."""
import datetime, json, math, pathlib, shutil, struct, urllib.parse, urllib.request, zlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
SITE=ROOT/'site'; CACHE=ROOT/'.cache'/'game-v2';CACHE.mkdir(parents=True,exist_ok=True)
BBOX=(34.065,47.638,34.132,47.676)
BASE_BBOX=(34.065,47.638,34.122,47.676)
FOCUS_BBOX=(34.113,47.649,34.132,47.664)  # Centralna 59 ↔ Lyceum 6 neighbourhood
UA='Game/0.4 (https://github.com/NMVAA/Game; OSM neighbourhood snapshot)'
def get(url,timeout=35):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json, text/javascript, */*'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return r.read(32_000_000)
def normalize(data):
    elements=data.get('elements',[]);nodes={e['id']:e for e in elements if e.get('type')=='node'};out=[]
    keep={'highway','name','name:uk','width','lanes','oneway','access','area','building','building:levels','height','leisure','natural','landuse','addr:street','addr:housenumber','amenity','footway','sidewalk','crossing','surface','lit','entrance','barrier'}
    for e in elements:
        t=e.get('tags',{})
        if e.get('type')=='node' and ('addr:housenumber' in t or t.get('amenity') in ('school','kindergarten','library','marketplace') or t.get('highway')=='crossing'):
            if isinstance(e.get('lat'),(int,float)) and isinstance(e.get('lon'),(int,float)):
                out.append({'type':'node','id':e['id'],'lat':e['lat'],'lon':e['lon'],'tags':{k:v for k,v in t.items() if k in keep}})
            continue
        if e.get('type')!='way' or not any(k in t for k in ('highway','building','leisure','natural','landuse')):continue
        raw=e.get('geometry') or [nodes.get(n) for n in e.get('nodes',[])]
        if len(raw)<2 or any(not p or not isinstance(p.get('lat'),(int,float)) or not isinstance(p.get('lon'),(int,float)) for p in raw):continue
        if not all(math.isfinite(p['lat']) and math.isfinite(p['lon']) for p in raw):continue
        # Ignore distant geometry returned as part of a very long way.
        if max(p['lat'] for p in raw)-min(p['lat'] for p in raw)>.09 or max(p['lon'] for p in raw)-min(p['lon'] for p in raw)>.13:continue
        out.append({'type':'way','id':e['id'],'nodes':e.get('nodes',[]),'tags':{k:v for k,v in t.items() if k in keep},'geometry':[{'lat':p['lat'],'lon':p['lon']} for p in raw]})
    roads=sum('highway' in e['tags'] for e in out);buildings=sum('building' in e['tags'] for e in out)
    if roads<20 or buildings<10:raise ValueError(f'Incomplete map: {roads} roads, {buildings} buildings')
    return {'version':.6,'generator':'Game static snapshot','copyright':'© OpenStreetMap contributors','license':'https://opendatacommons.org/licenses/odbl/1-0/','metadata':{'bbox':BBOX,'prepared_at':datetime.datetime.now(datetime.timezone.utc).isoformat()},'elements':out}
def focus_roads(data):
    # Verify actual mapped street geometry in the eastern part of the requested area.
    return sum(
        1 for e in data.get('elements',[])
        if e.get('type')=='way' and 'highway' in e.get('tags',{})
        and any(p.get('lon',0)>34.123 and 47.650<p.get('lat',0)<47.665 for p in e.get('geometry',[]))
    )
def sources(bbox,query):
    return [
        'https://api.openstreetmap.org/api/0.6/map.json?bbox='+','.join(map(str,bbox)),
        'https://overpass-api.de/api/interpreter?'+urllib.parse.urlencode({'data':query}),
        'https://overpass.kumi.systems/api/interpreter?'+urllib.parse.urlencode({'data':query})
    ]
def merge(base,more):
    # Merge by stable OSM object ID so roads crossing the two map extracts are not duplicated.
    features={(e['type'],e['id']):e for e in base['elements']}
    for item in more['elements']:features[(item['type'],item['id'])]=item
    return normalize({'elements':list(features.values())})
def map_data():
    previous=None
    for path in [ROOT/'map'/'pokrov.json',CACHE/'pokrov.json']:
        if path.is_file():
            try:
                candidate=normalize(json.loads(path.read_text()))
                if focus_roads(candidate)>=5:return candidate
                previous=candidate
            except Exception as e:print(f'Ignoring invalid cache: {e}',flush=True)
    base_query='[out:json][timeout:40];(way["highway"](47.638,34.065,47.676,34.122);way["building"](47.638,34.065,47.676,34.122);way["leisure"="park"](47.638,34.065,47.676,34.122);way["natural"="water"](47.638,34.065,47.676,34.122););out geom;'
    base_urls=['https://nmvaa.github.io/Game/map/pokrov.json']+sources(BASE_BBOX,base_query)
    if previous is None:
        for url in base_urls:
            try:
                print('Base map source:',url.split('?')[0],flush=True)
                previous=normalize(json.loads(get(url)))
                break
            except Exception as e:print('Base source unavailable:',str(e)[:220],flush=True)
    if previous is None:raise RuntimeError('No valid base OSM map. Existing deployed site remains unchanged.')
    if focus_roads(previous)>=5:
        (CACHE/'pokrov.json').write_text(json.dumps(previous,separators=(',',':'),ensure_ascii=False))
        return previous
    # The original map stopped at 34.122 E, before Centralna 59.
    # Fetch a smaller adjacent extract rather than downloading a huge full-city export.
    q='[out:json][timeout:40];(way["highway"](47.649,34.113,47.664,34.132);way["building"](47.649,34.113,47.664,34.132);way["leisure"](47.649,34.113,47.664,34.132);way["natural"="water"](47.649,34.113,47.664,34.132);node["addr:housenumber"](47.649,34.113,47.664,34.132);node["amenity"="school"](47.649,34.113,47.664,34.132);node["highway"="crossing"](47.649,34.113,47.664,34.132););out geom;'
    for url in sources(FOCUS_BBOX,q):
        try:
            print('Neighbourhood map source:',url.split('?')[0],flush=True)
            detail=normalize(json.loads(get(url,timeout=45)))
            result=merge(previous,detail)
            if focus_roads(result)<5:raise ValueError('Map does not cover Centralna 59 neighbourhood')
            (CACHE/'pokrov.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False))
            print('East-side detail: ',focus_roads(result),'roads; source validated',flush=True)
            return result
        except Exception as e:print('Neighbourhood source unavailable:',str(e)[:250],flush=True)
    raise RuntimeError('Real OSM corridor to Centralna 59 unavailable; refusing to publish an invented route.')
def vendor():
    path=CACHE/'three-0.170.0.module.js'
    if path.is_file() and path.stat().st_size>100000:return path.read_bytes()
    sources=['https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js','https://unpkg.com/three@0.170.0/build/three.module.min.js','https://raw.githubusercontent.com/mrdoob/three.js/r170/build/three.module.js']
    for url in sources:
        try:
            content=get(url)
            if len(content)<100000 or b'WebGLRenderer' not in content:raise ValueError('Invalid Three.js response')
            path.write_bytes(content);return content
        except Exception as e:print('Vendor source unavailable:',e,flush=True)
    raise RuntimeError('Could not bundle Three.js; refuse deployment with a missing engine.')
def icon(size):
    # Vector-like block G on an opaque square, safely inside the maskable area.
    pixels=bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            u=x/size;v=y/size;c=(16,25,30)
            if ((.26<u<.34 and .25<v<.73) or (.26<u<.74 and .25<v<.33) or (.26<u<.74 and .65<v<.73) or (.66<u<.74 and .48<v<.73) or (.48<u<.74 and .48<v<.56)):c=(164,224,213)
            if .46<u<.54 and .79<v<.81:c=(244,201,125)
            pixels.extend(c)
    def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(pixels),9))+chunk(b'IEND',b'')
def main():
    if SITE.exists():shutil.rmtree(SITE)
    SITE.mkdir();shutil.copytree(ROOT/'src',SITE/'src')
    for f in ['index.html','manifest.webmanifest','icon.svg','sw.js']:shutil.copy2(ROOT/f,SITE/f)
    (SITE/'vendor').mkdir();(SITE/'vendor'/'three.module.js').write_bytes(vendor())
    shutil.copy2(ROOT/'THIRD_PARTY.txt',SITE/'vendor'/'LICENSE.txt')
    (SITE/'map').mkdir();data=map_data();(SITE/'map'/'pokrov.json').write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False))
    (SITE/'map'/'README.txt').write_text('OpenStreetMap data © OpenStreetMap contributors; ODbL 1.0.\nhttps://www.openstreetmap.org/copyright\nhttps://opendatacommons.org/licenses/odbl/1-0/\nThis downloadable snapshot is the source database for the game map.\n')
    (SITE/'icons').mkdir()
    for size in [192,512]:(SITE/'icons'/f'icon-{size}.png').write_bytes(icon(size))
    (SITE/'.nojekyll').touch();print('Prepared site with',len(data['elements']),'real map features',flush=True)
if __name__=='__main__':main()
