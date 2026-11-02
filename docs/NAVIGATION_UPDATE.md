# Navigation and mobile polish candidate

Prepared from inspected commit `0a3036e32bcf12cf73bf2734b692d3e564e06542`.

## Changes

- Tap the minimap to open an accessible full-screen atlas with pan, pinch zoom, zoom buttons, road labels, player location and delivery route.
- A lightweight route ribbon is rendered on the next section of road. It disappears in free-drive mode.
- Six body paint choices and saved graphics, sound, night and camera settings.
- Synchronous HUD updates when changing game mode or resuming, instead of waiting on a render-frame timer.
- Merge static car body parts by material; hide distant traffic rendering; measure FPS using actual wall-clock time; do not render a hidden document.
- Precache the new module and refresh an old worker-controlled page when a complete new release activates.
- Browser regression checks include input release, context-menu suppression, map interaction, orientation, mode switches and offline settings persistence.

## Integration safety

Parallel first-person walking changes appeared on main while this work was being prepared. This candidate is intentionally isolated: do not overwrite main with its files. Integrate the navigation module into the walking/driving state and retain the new walking controls, tests and cache version. Only main is allowed to deploy to GitHub Pages; the candidate branch only builds and tests.

This is a development increment, not a claim of AAA production quality. Browser emulation does not establish frame rate or battery use on a physical phone.
