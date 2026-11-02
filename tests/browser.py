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
            page.screenshot(path=str(OUTPUT/'01-menu-portrait.png'))
            page.locator('#start').click();page.wait_for_timeout(700)
            assert page.evaluate('window.__GAME_TEST__.paused') is False
            # A held pedal must work and pointer capture must release correctly.
            rect=page.locator('#gas').bounding_box();page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2);page.mouse.down()
            # Wait on simulation progress: software WebGL rendering is not real-time.
            page.wait_for_function('window.__GAME_TEST__.state.travel > 2',timeout=45000)
            page.mouse.up()
            state=page.evaluate('window.__GAME_TEST__.state');assert state['travel']>2,state
            page.screenshot(path=str(OUTPUT/'02-drive-portrait.png'))
            page.locator('#pause').click();assert page.evaluate('window.__GAME_TEST__.paused') is True
            page.locator('#quality').select_option('low');page.locator('#night').click();page.locator('#resume').click();page.wait_for_timeout(700)
            page.screenshot(path=str(OUTPUT/'03-night-portrait.png'))
            page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(500)
            page.screenshot(path=str(OUTPUT/'04-drive-landscape.png'))
            for selector in ['#gas','#brake','#steering','#pause']:
                box=page.locator(selector).bounding_box();assert box and box['x']>=0 and box['y']>=0 and box['x']+box['width']<=845 and box['y']+box['height']<=391,(selector,box)
            page.locator('#pause').click();page.locator('#mode').select_option('free');page.locator('#resume').click();page.wait_for_timeout(300)
            assert page.locator('#mission-name').inner_text()=='Вільна поїздка'
            page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=60000)
            # No CDN or Overpass request is required after installation.
            ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__GAME_TEST__?.ready === true',timeout=90000)
            page.locator('#start').click();page.screenshot(path=str(OUTPUT/'05-offline.png'));ctx.set_offline(False)
            assert not errors,errors
            report={'status':'passed','map':data,'state_after_drive':state,'offline_reload':True,'javascript_errors':errors,'render':page.evaluate('window.__GAME_TEST__.render')}
            (OUTPUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
        except Exception:
            page.screenshot(path=str(OUTPUT/'failure.png'));(OUTPUT/'errors.json').write_text(json.dumps(errors,ensure_ascii=False));raise
        finally:
            shutil.make_archive(str(OUTPUT/'game-debug-site'),'zip',ROOT/'site')
            browser.close();server.shutdown()
