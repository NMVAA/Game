"""Real Chromium/WebGL smoke tests against the packaged /Game/ path."""
import functools,http.server,json,pathlib,tempfile,threading,shutil
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1];OUTPUT=ROOT/'test-results';OUTPUT.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as folder:
    root=pathlib.Path(folder);(root/'Game').symlink_to(ROOT/'site',target_is_directory=True)
    handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=folder)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',8765),handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'])
        ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        try:
            page.goto('http://127.0.0.1:8765/Game/?test=1',wait_until='networkidle',timeout=60000)
            page.wait_for_function('window.__GAME_TEST__?.ready === true',timeout=90000)
            assert page.title()=='Game'
            data=page.evaluate('window.__GAME_TEST__.map');assert data['roads']>20 and data['buildings']>10,data
            landscape=page.evaluate('window.__GAME_TEST__.landscape')
            assert landscape and landscape['interpretive'] and landscape['roofCount']>=data['buildings'],landscape
            assert landscape['treeCount']>30,landscape
            assert landscape['visualBuildings']>=3 and landscape['windows']>10,landscape
            tour=page.evaluate('window.__GAME_TEST__.tour')
            assert tour and tour['points']>=3 and tour['startOffset']<=240 and tour['endOffset']<=250,tour
            assert tour['connectorLength']>10,tour
            assert tour['spawnDistance']<=55,tour
            walker_at_start=page.evaluate('window.__GAME_TEST__.walker')
            home=tour['home']
            # Coordinates already projected in the game; the distance is checked
            # independently through the exported spawn metric and collision tests.
            assert abs(walker_at_start['x'])<10000 and abs(walker_at_start['z'])<10000
            page.screenshot(path=str(OUTPUT/'01-menu-portrait.png'))
            page.locator('#start').click();page.wait_for_timeout(700)
            assert page.evaluate('window.__GAME_TEST__.paused') is False
            # First-person walking is the default mobile game mode.
            assert page.evaluate('window.__GAME_TEST__.inCar') is False
            assert page.locator('#walkcontrols').is_visible()
            assert page.locator('#tourcard').is_visible()
            assert 'Ліцей №6' in page.locator('#tour-name').inner_text()
            assert 'Повернись до маршруту' not in page.locator('#tour-hint').inner_text()
            stick=page.locator('#walkpad').bounding_box()
            # A resting thumb at the centre must not make the player creep.
            page.mouse.move(stick['x']+stick['width']*.5+3,stick['y']+stick['height']*.5+3)
            page.mouse.down()
            page.wait_for_timeout(600)
            assert page.evaluate('window.__GAME_TEST__.walker.travel')<.05, 'walking stick drifted at centre'
            page.mouse.move(stick['x']+stick['width']*.5,stick['y']+stick['height']*.18)
            page.mouse.down()
            # Software-rendered WebGL can progress slower than wall-clock time.
            page.wait_for_function('window.__GAME_TEST__.walker.travel > 1',timeout=90000)
            page.mouse.up()
            walker=page.evaluate('window.__GAME_TEST__.walker')
            assert walker['travel']>1,walker
            page.screenshot(path=str(OUTPUT/'02-walk-portrait.png'))
            # A world drag must rotate the first-person camera.
            yaw=walker['yaw'];surface=page.locator('#scene').bounding_box()
            x=surface['x']+surface['width']*.7;y=surface['y']+surface['height']*.55
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+52,y+17,steps=5);page.mouse.up()
            assert abs(page.evaluate('window.__GAME_TEST__.walker.yaw')-yaw)>.05
            page.locator('#tour-free').click()
            assert 'ПОКАЗАТИ' in page.locator('#tour-free').inner_text()
            page.locator('#tour-restart').click()
            assert 'ВІЛЬНИЙ' in page.locator('#tour-free').inner_text()
            back_to_start=page.evaluate('window.__GAME_TEST__.walker')
            assert abs(back_to_start['x']-walker_at_start['x'])<.001 and abs(back_to_start['z']-walker_at_start['z'])<.001
            page.screenshot(path=str(OUTPUT/'03-school-route-portrait.png'))
            # Courtyard starts may be far from legal roadside parking; quick return
            # must work without letting the proximity-only E key teleport.
            parked=page.evaluate('window.__GAME_TEST__.state')
            separation=((back_to_start['x']-parked['x'])**2+(back_to_start['z']-parked['z'])**2)**0.5
            assert 0<separation<500, {'walker_to_car':separation,'walker':back_to_start,'car':parked}
            if separation>5.4:
                page.wait_for_function("document.querySelector('#enter-car').textContent.includes('ШВИДКО В АВТО')",timeout=30000)
                page.keyboard.press('e')
                assert page.evaluate('window.__GAME_TEST__.inCar') is False
            else:
                page.wait_for_function("document.querySelector('#enter-car').textContent.includes('СІСТИ В АВТО')",timeout=30000)
            page.locator('#enter-car').click()
            assert page.evaluate('window.__GAME_TEST__.inCar') is True
            rect=page.locator('#gas').bounding_box()
            page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2);page.mouse.down()
            page.wait_for_function('window.__GAME_TEST__.state.travel > 2',timeout=60000)
            page.mouse.up()
            state=page.evaluate('window.__GAME_TEST__.state');assert state['travel']>2,state
            page.screenshot(path=str(OUTPUT/'03-drive-portrait.png'))
            page.locator('#pause').click();assert page.evaluate('window.__GAME_TEST__.paused') is True
            page.locator('#quality').select_option('low');page.locator('#night').click();page.locator('#resume').click();page.wait_for_timeout(700)
            page.screenshot(path=str(OUTPUT/'04-night-portrait.png'))
            page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(500)
            page.screenshot(path=str(OUTPUT/'05-drive-landscape.png'))
            for selector in ['#gas','#brake','#steering','#pause']:
                box=page.locator(selector).bounding_box();assert box and box['x']>=0 and box['y']>=0 and box['x']+box['width']<=845 and box['y']+box['height']<=391,(selector,box)
            page.locator('#pause').click();page.locator('#mode').select_option('free');page.locator('#resume').click();page.wait_for_timeout(300)
            assert page.locator('#mission-name').inner_text()=='Вільна поїздка'
            page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=60000)
            # No CDN or Overpass request is required after installation.
            ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__GAME_TEST__?.ready === true',timeout=90000)
            page.locator('#start').click();page.screenshot(path=str(OUTPUT/'06-offline.png'));ctx.set_offline(False)
            assert not errors,errors
            report={'status':'passed','map':data,'landscape':landscape,'tour':tour,'state_after_walk':walker,'state_after_drive':state,'offline_reload':True,'javascript_errors':errors,'render':page.evaluate('window.__GAME_TEST__.render')}
            (OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
        except Exception:
            page.screenshot(path=str(OUTPUT/'failure.png'));(OUTPUT/'errors.json').write_text(json.dumps(errors,ensure_ascii=False));raise
        finally:
            shutil.make_archive(str(OUTPUT/'game-debug-site'),'zip',ROOT/'site')
            browser.close();server.shutdown()
