# Neon Harbor test plan

## Automated coverage

- Procedural world: seed determinism, distinct seeds, coastline/water exclusion, district mapping, road clearance, streaming radius, finite LRU cache, object reuse, and bounded draw-call estimation.
- Controls: analogue normalization, camera-relative direction, acceleration, walking and sprint caps, jump/ground cycle, collision sliding, frame-gap clamping, and vehicle mode.
- Character/UI: splash, menu, new-story selection, name fallback, and direct access to map, garage, progress, and settings.
- Traffic: fixed pool size, deterministic positions, movement, headings, and wrapping within the streamed area.

Run with `npm test`. The suite is deterministic and does not need a GPU or Android emulator.

## Android device acceptance checks

1. Cold-launch in portrait and landscape; confirm no system-bar overlap and all main-menu buttons remain visible.
2. Start a new story, select each character, type a name, and verify the chosen model loads in gameplay.
3. Hold the joystick at 25%, 75%, and the outer sprint ring. Verify proportional walk, run transition, animation, and camera-relative direction.
4. Tap Jump while standing, airborne, against a wall, and while driving. Confirm one grounded jump, no air jump, collision slide, and no vehicle jump.
5. Walk across four chunk boundaries. Confirm no visible pause, scenery remains off roads, traffic wraps, and memory stays stable.
6. Approach buildings and parked cars from each side. Confirm solid collision and reliable Drive/Exit switching.
7. Drive at full speed for five minutes and across every district. Confirm stable follow camera, speedometer, minimap, and district banner.
8. Open Pause, Map, Settings, Garage, and Progress from both orientations. Confirm back/resume returns to the correct screen.
9. Test Low, Medium, and High graphics on a real device; verify Low disables shadows and High remains responsive on the target device.
10. Enable Android “Don’t keep activities,” background the app, then return. Confirm the WebView reloads safely and no screen is broken.

## Performance gates

- 25 streamed chunks at Balanced view distance; cache remains at or below 81 chunks.
- Buildings, palms, lights, roads, ground, parked vehicles, and traffic are each submitted as instanced pools.
- Target: 30 FPS minimum on a mid-range Android device and no monotonic heap growth during a ten-minute drive.
