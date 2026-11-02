"""Chromium/WebGL tests at /Game/, including real map, controls and offline reload."""
import functools
import http.server
import json
import os
import traceback
import pathlib
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results'
OUTPUT.mkdir(exist_ok=True)
checks = []

def check(name):
    checks.append(name)
    print('PASS:', name, flush=True)

with tempfile.TemporaryDirectory() as folder:
    root = pathlib.Path(folder)
    (root / 'Game').symlink_to(ROOT / 'site', target_is_directory=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=folder)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.environ.get('GAME_CHROMIUM'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'])
        ctx = browser.new_context(viewport={'width':390, 'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        expect.set_options(timeout=30000)
        try:
            page.goto('http://127.0.0.1:8765/Game/?test=1', wait_until='networkidle', timeout=60000)
            page.wait_for_function('window.__GAME_TEST__?.ready === true', timeout=90000)
            expect(page).to_have_title('Game')
            assert page.evaluate('window.__GAME_TEST__.version') == '0.3.0'
            data = page.evaluate('window.__GAME_TEST__.map')
            assert data['roads'] > 20 and data['buildings'] > 10, data
            check('real map and release boot')
            page.screenshot(path=str(OUTPUT/'01-menu-portrait.png'))
            page.locator('#start').click()
            page.wait_for_function('window.__GAME_TEST__.paused === false')
            assert page.evaluate('window.__GAME_TEST__.navigation.ribbon')
            rect = page.locator('#gas').bounding_box()
            page.mouse.move(rect['x'] + rect['width']/2, rect['y'] + rect['height']/2)
            page.mouse.down()
            # Measured simulation progress, not a fixed sleep on slow software WebGL.
            page.wait_for_function('window.__GAME_TEST__.state.travel > 2', timeout=60000)
            page.mouse.up()
            page.wait_for_function('window.__GAME_TEST__.input.held.length === 0')
            state = page.evaluate('window.__GAME_TEST__.state')
            check('held throttle moves car and releases cleanly')
            cancelled = page.locator('#gas').evaluate("e => !e.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true}))")
            assert cancelled
            check('control context menu suppressed')
            page.screenshot(path=str(OUTPUT/'02-drive-portrait.png'))
            page.locator('#minimap').click()
            expect(page.locator('#atlas')).to_be_visible()
            assert page.evaluate('window.__GAME_TEST__.paused')
            page.locator('#atlas-in').click()
            page.locator('#atlas-player').click()
            page.screenshot(path=str(OUTPUT/'03-full-map.png'))
            page.locator('#atlas-close').click()
            expect(page.locator('#atlas')).to_be_hidden()
            assert not page.evaluate('window.__GAME_TEST__.paused')
            check('full map, zoom, player locator and resume')
            page.locator('#pause').click()
            page.locator('#quality').select_option('low')
            page.locator('[data-paint="#b64936"]').click()
            assert page.evaluate('window.__GAME_TEST__.navigation.paint') == '#b64936'
            page.locator('#night').click()
            page.locator('#resume').click()
            page.screenshot(path=str(OUTPUT/'04-night-portrait.png'))
            page.set_viewport_size({'width':844, 'height':390})
            # Wait for the responsive layout rather than depending on a render frame.
            page.wait_for_function('innerWidth === 844')
            page.screenshot(path=str(OUTPUT/'05-drive-landscape.png'))
            for selector in ['#gas','#brake','#steering','#pause']:
                box = page.locator(selector).bounding_box()
                assert box and box['x'] >= 0 and box['y'] >= 0 and box['x']+box['width'] <= 845 and box['y']+box['height'] <= 391, (selector,box)
            check('portrait and landscape control bounds')
            page.locator('#pause').click()
            page.locator('#mode').select_option('free')
            page.locator('#resume').click()
            expect(page.locator('#mission-name')).to_have_text('Вільна поїздка')
            assert not page.evaluate('window.__GAME_TEST__.navigation.ribbon')
            page.locator('#pause').click()
            page.locator('#mode').select_option('delivery')
            page.locator('#resume').click()
            expect(page.locator('#mission-name')).not_to_have_text('Вільна поїздка')
            assert page.evaluate('window.__GAME_TEST__.navigation.ribbon')
            check('free/delivery switch updates HUD and route immediately')
            page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
            await_cache = """async () => {
                const keys = await caches.keys();
                const key = keys.find(k => k.endsWith(':0.3.0'));
                if (!key) return false;
                const c = await caches.open(key);
                return !!await c.match(new URL('./src/navigation.mjs', location.href).href);
            }"""
            page.wait_for_function(await_cache, timeout=60000)
            ctx.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function('window.__GAME_TEST__?.ready === true', timeout=90000)
            assert page.evaluate('window.__GAME_TEST__.navigation.paint') == '#b64936'
            assert page.locator('#quality').input_value() == 'low'
            expect(page.locator('#night')).to_have_text('Ніч → день')
            page.locator('#start').click()
            page.screenshot(path=str(OUTPUT/'06-offline.png'))
            check('offline reload preserves paint, graphics and night settings')
            ctx.set_offline(False)
            assert not errors, errors
            report = {'status':'passed', 'release':'0.3.0', 'checks':checks, 'map':data, 'state_after_drive':state, 'offline_reload':True, 'javascript_errors':errors, 'render':page.evaluate('window.__GAME_TEST__.render')}
            (OUTPUT/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
            print(json.dumps(report, ensure_ascii=False), flush=True)
        except Exception:
            traceback.print_exc()
            (OUTPUT/'errors.json').write_text(json.dumps(errors, ensure_ascii=False))
            try:
                page.screenshot(path=str(OUTPUT/'failure.png'),timeout=5000)
            except Exception as error:
                print('Screenshot unavailable:',error,flush=True)
            raise
        finally:
            shutil.make_archive(str(OUTPUT/'game-debug-site'), 'zip', ROOT/'site')
            browser.close()
            server.shutdown()
