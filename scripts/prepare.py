"""Build a self-contained Pages artifact. Never replace real map data with a mock."""
import datetime, json, math, pathlib, shutil, struct, urllib.parse, urllib.request, zlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
SITE=ROOT/'site'; CACHE=ROOT/'.cache'/'game-v2';CACHE.mkdir(parents=True,exist_ok=True)
BBOX=(34.065,47.638,34.122,47.676)
UA='Game/0.2 (https://github.com/NMVAA/Game; static map snapshot)'
def get(url,timeout=35):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json, text/javascript, */*'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return r.read(32_000_000)
def normalize(data):
    elements=data.get('elements',[]);nodes={e['id']:e for e in elements if e.get('type')=='node'};out=[]
    keep={'highway','name','name:uk','width','lanes','oneway','access','area','building','building:levels','height','leisure','natural','landuse'}
    for e in elements:
        t=e.get('tags',{})
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
def map_data():
    for path in [ROOT/'map'/'pokrov.json',CACHE/'pokrov.json']:
        if path.is_file():
            try:return normalize(json.loads(path.read_text()))
            except Exception as e:print(f'Ignoring invalid cache: {e}')
    query='[out:json][timeout:30];(way["highway"](47.638,34.065,47.676,34.122);way["building"](47.638,34.065,47.676,34.122);way["leisure"="park"](47.638,34.065,47.676,34.122);way["natural"="water"](47.638,34.065,47.676,34.122););out geom;'
    sources=['https://nmvaa.github.io/Game/map/pokrov.json','https://api.openstreetmap.org/api/0.6/map.json?bbox='+','.join(map(str,BBOX)),'https://overpass-api.de/api/interpreter?'+urllib.parse.urlencode({'data':query}),'https://overpass.kumi.systems/api/interpreter?'+urllib.parse.urlencode({'data':query})]
    for url in sources:
        try:
            print('Map source:',url.split('?')[0],flush=True);data=normalize(json.loads(get(url)));(CACHE/'pokrov.json').write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False));return data
        except Exception as e:print('Source unavailable:',str(e)[:240],flush=True)
    raise RuntimeError('No valid OSM snapshot. Deployment stopped; existing public site is unchanged.')
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
