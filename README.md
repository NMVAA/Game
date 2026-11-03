# Game

A mobile-first Three.js driving game on an OpenStreetMap street network of Pokrov, Dnipropetrovsk oblast, Ukraine. Public site: https://nmvaa.github.io/Game/

## Version 0.4.4 — Full-width vehicle collision and sideways crash damage

- Extend swept car collisions from front/rear probes to three overlapping footprint circles. Narrow objects beside a door can no longer pass through the middle of the vehicle.
- Compute collision damage from total planar impact speed instead of forward speed alone, so high-speed lateral slides and handbrake incidents also damage the car.
- Add regression coverage for side-door contact and lateral impact damage; update the versioned offline PWA cache.

## Version 0.4.3 — Faster street-network navigation

- Replaced the linear-scan A* frontier for driving routes with a binary min-heap. Large OSM road graphs require fewer operations during trip planning and rerouting, improving mobile responsiveness.
- Added shortest-path, unreachable-junction and 4,096-node grid regression tests.
- Updated browser version and offline PWA cache so existing installations can pick up the change.

## Version 0.4.2 — Safe courtyard start and quick vehicle return

- The walking tour keeps its collision-free start near Centralna 59 even when a car cannot park within normal boarding distance.
- The mobile walking controls explicitly offer **ШВИДКО В АВТО** (fast return) when the parked car is far away. Keyboard E still requires proximity, avoiding accidental teleportation.
- Parking selection prefers a clearance-checked mapped-road candidate, and the new browser and unit tests cover both nearby boarding and distant-car recovery.
- PWA caches and the versioned module URLs are updated so existing installations receive the fix.

## Version 0.4.1 — Spawn beside Centralna 59

- The first-person character now starts near the mapped/approximate house-number 59 reference, not at an arbitrary route node.
- Starting location and route restart select a collision-free location near the address and a nearby mapped-road parking spot.
- The game preserves money and walking distance but resets position to house 59 at every new launch.
- Browser and CI tests reject builds where the start is farther than 55 metres from the house reference.
- House 59 anchor remains **approximate** without a verified OSM address and does not imply a known front door.

## Version 0.4.0 — Centralna 59 → Lyceum 6

- First-person pedestrian tour of the Centralna 59–Chiatur­ska 6 corridor, with route-finding on mapped OSM walkable streets and paths.
- School point coordinates are verified; the Centralna 59 starting point is marked as **approximate** unless the map contains an explicit address 59 tag.
- Eastern neighborhood geometry is added to the deployed OSM snapshot (the previous map ended near longitude 34.122 and omitted the requested building area).
- Floating in-world address/school markers, suggested street direction, mapped crossings (where available), routing line, illustrated urban furniture and a dedicated minimap overlay.
- The route is a **game approximation**, not a certified pedestrian navigation route. Decorative benches and signs are generated for atmosphere and do not claim to exist on site.
- The source layout includes `src/neighborhood.mjs` and `src/neighborhood-scene.mjs`; CI tests the route, map coverage and mobile UI.

## Version 0.2.0

This release replaces the original random-grid demo. It is a substantial prototype upgrade, **not an AAA release or a photorealistic reconstruction**.

- Real OSM roads and footprints loaded from a static snapshot hosted with the game. No silent fictional-map fallback. Missing geometry fails the deployment instead of publishing a broken city.
- Batched building geometry, facade windows, asphalt, sidewalks, markings, instanced trees, streetlights, shadows, day/night lighting, a detailed procedural car and three cameras.
- Fixed-step arcade driving, analog touch steering, braking/reverse, handbrake, grip, off-road drag, swept building/tree collisions, damage, ambient traffic, tire marks and dust.
- Deliveries on the largest connected drivable road graph, route guidance, stop-to-complete checkpoints, rewards, fuel, repairs and engine/tire upgrades. Free-drive mode is available in Pause.
- Synthesized engine audio, quality presets and automatic resolution reduction. Performance on the user's actual phone remains to be measured; the software-rendered CI browser is not a phone benchmark.
- Versioned PWA cache, PNG install icons, locally bundled Three.js and map, offline re-entry after the first complete installation. Existing money/mission/fuel data migrates from `pokrov-save-v1`.

## Controls

Touch: left thumb pad steers; right pedals accelerate and brake/reverse; Handbrake enables sliding. Camera switches chase/hood/overhead views. Pause opens graphics, audio, day/night, free-drive, garage and recovery controls.

Keyboard: WASD/arrows, Space for handbrake, C for camera, Esc for pause. Losing focus clears all held controls and pauses the simulation.

## Source layout

`src/core.mjs` contains deterministic geometry, routing and vehicle logic with no rendering dependencies. `src/world.mjs` builds the Three.js scene and vehicles. `src/game.mjs` owns input, simulation, missions, audio, navigation and UI. `src/ui.css` contains responsive portrait/landscape layouts.

`scripts/prepare.py` creates `site/`, bundles the pinned Three.js 0.170.0 module, validates and packages an OSM snapshot, and generates PWA PNG icons. Snapshot data is reused from the build cache or the published site before requesting an OSM API. Network requests do not run on the player's phone. Bump the asset cache key to refresh the snapshot. A build requires at least 20 roads and 10 buildings; the real connected graph is also validated.

## Tests and deployment

```
node --test tests/core.test.mjs
python3 scripts/prepare.py
python3 -m pip install playwright==1.56.0
python3 -m playwright install --with-deps chromium
python3 tests/browser.py
```

The GitHub Pages workflow runs logic tests, prepares assets, validates the real graph, then runs Chromium checks at the `/Game/` subpath: startup, held pedal input, pause/resume, quality and night toggles, portrait/landscape layouts, free-drive and offline reload. Screenshots and a JSON report are uploaded as `game-test-results`. Only a passing build is deployed. These checks do not establish AAA quality or real-device performance.

## Geographic fidelity and limitations

Roads and building outlines are real OSM geometry, within the available snapshot's coverage. Ground is flat. Building heights use OSM tags where available and estimates otherwise. Facades, car models, vegetation and street furniture are procedural and may not match the real city. Multipolygon reconstruction, realistic terrain, one-way-aware traffic and advanced wheel suspension are not implemented. The collision model is an arcade approximation, not a full rigid-body simulation. Persistent saves use browser storage and can be removed by the browser/user.

Attribution is visible in the game. OSM source data is distributed under ODbL as `map/pokrov.json`; see `THIRD_PARTY.txt` for dependency and data licensing.
