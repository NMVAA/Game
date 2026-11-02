# Game: quality roadmap

## 0.2 delivery gate
- Deterministic tests pass.
- Real map has reachable missions.
- Browser has no uncaught errors or shader compilation errors.
- Touch controls fit both orientations and never remain held after focus loss.
- The installed application can reopen with networking disabled.

## Next quality gates
1. Measure actual Android frame time, memory, battery draw and thermal throttling. Target a sustained 30 FPS baseline before adding heavier effects; do not claim a target was met based on CI.
2. Add licensed optimized vehicle/building glTF assets, physically based textures, audio recordings and explicit asset budgets; retain provenance/licenses.
3. Improve street graph junctions, one-way traffic, signals, vehicle avoidance and exact polygon collisions. Add proper suspension and a tunable tire model.
4. Add elevation/terrain, water and multipolygon support from verified sources. Audit recognizable city locations with reference material rather than inventing exact facades.
5. Expand mission types, progression, location-based garages, pedestrian behaviors, accessibility and input customization.
6. Run longer real-device gameplay, save migration and offline/update regression tests. Profile before increasing world density, draw distance or post-processing.

AAA is a production-quality ambition, not a label applied to a single browser prototype iteration. Each release should have measurable improvements and verified tests.
