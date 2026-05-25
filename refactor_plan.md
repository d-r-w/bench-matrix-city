## Extraction Plan: `test.html` → TypeScript Project

> **Source of truth**: `test.html` is immutable — it is the original, working codebase and will not be modified. All line references below point to this file for traceability during extraction.
>
> ### Current Status (2026-05-26)
>
> | Phase | Status |
> |-------|--------|
> | 0 — Tooling Setup | ✅ Done |
> | 1 — Project Skeleton & Types | ✅ Done |
> | 2 — Shader Extraction | ✅ Done (12 modules) |
> | 3 — Texture Utilities | ✅ Done, verified against test.html |
> | 4 — City Generation | ✅ Done, **bugs fixed** in `instanced-mesh.ts` (see Fix Log below) |
> | 5 — Vehicles & Drones | ✅ Done (`vehicle.ts`, `police-drone.ts`, `drone-manager.ts`) |
> | 6 — Scene Effects | ✅ Done (all 5 modules: ground-grid, rain, haze-layers, starfield, light-beams) |
> | 7 — Camera System | ✅ Done (`flythrough.ts` with steer button + drone fly loop) |
> | 8 — PiP Overlay | ✅ Done (`pip-overlay.ts` with WeakMap state, drag/resize/zoom/pan) |
> | 9 — Wire main.ts | ✅ Done — all subsystems wired: init() builds everything, animate() calls all update functions |
> | 10 — HTML Shell + Server | ✅ Done — `index.html` is thin shell with CSS link + script imports; `server.ts` exists |
>
> ### Fix Log
>
> **2026-05-26** — Verified Phase 3/4 against `test.html`. Found and fixed 5 bugs in `src/city/instanced-mesh.ts`:
>
> | # | Bug | Original (test.html) | Extracted (was) |
> |---|-----|----------------------|-----------------|
> | 1 | Char pool hardcoded to `512` | `Math.random() * CHARS.length` (~160 chars) | `Math.random() * 512` → picked indices beyond atlas content, producing blank glyphs |
> | 2 | UV row divisor wrong | `Math.floor(idx / ATLAS_COLS)` (÷32) then `/ ATLAS_ROWS` | `Math.floor(idx / ATLAS_ROWS)` (÷16) → mapped characters to wrong atlas rows. Also fixed in `computeUVOffsets()`. |
> | 3 | Unintended brightness modulation on refresh | No change to `instanceBright` during animation loop | Random dimming: `brightVal * (0.5 + Math.random() * 0.5)` — removed |
> | 4 | Alpha decay formula differs | `Math.max(0.01, 1.0 - elapsedSinceRefresh / decayRate)` with floor at `0.01` | `alpha -= dt * decayRate` with floor at `0` → characters disappeared completely instead of fading to dim glow |
> | 5 | Scale sync + needsUpdate missing | Per-frame scale reset (0.45/0.38) + `instanceScale.needsUpdate = true` | Never touched scales in update loop — added back |
>
> Refresh scheduling also corrected: removed `(0.5 + Math.random())` multiplier not present in original; now uses `t + refreshRates[i]` exactly.
>
> **2026-05-26** — Completed Phases 5–7, wired Phase 9:
>
> | # | Fix | Details |
>|---|-----|---------|
>| 1 | Haze layers type mismatch | `scene.children.filter()` returned `Object3D[]` but globals declared `Mesh[]`. Fixed by collecting meshes directly in build loop. |
>| 2 | ShaderMaterial cast on ground plane / rain | `.material.uniforms` not accessible on base `Material` type. Added explicit `ShaderMaterial` casts. |
>| 3 | Light-beam child.material access | `group.children` are `Object3D[]`, need cast to `Mesh` before accessing `.material`. Fixed with typed cast + optional chain. |
>| 4 | Drone-manager unused import/param | Removed unused `GRID` import, prefixed unused `dt` param with `_`. |
>| 5 | city-builder stubs replaced | Replaced inline `_createVehicle()` / `_buildPoliceDrones()` placeholders with real imports from `vehicles/`. Vehicles collected in explicit array instead of `scene.children.filter()`. |
>
> ### Key line ranges in `test.html`
>
> | Section | Lines |
> |---------|-------|
> | HTML head (style + importmap) | L1-L52 |
> | Three.js imports | L54-L58 |
> | Constants (GRID, CELL, BUILDING_WIDTH) | L68-L70 |
> | Scene/camera/renderer globals + clock | L72-L73 |
> | Manual steering state (manualSteering, mouseNDC, freePos/Yaw/Pitch/Speed) | L75-L82 |
> | CHARS string + charToIndex Map + randChar() | L84-L93 |
> | ATLAS_COLS/ROWS, CELL_SIZE | L101-L103 |
> | Texture factories (buildCharStreamTexture, buildTextureAtlas) | L105-L167 |
> | MAX_CACHE_SIZE, texCache, getCharTex, makeCharTexture | L169-L193 |
> | `init()` — scene setup, composer, vignette pass, steer button | L195-L342 |
> | City helpers (calcBuildingHeight → addRoofChars) | L346-L470 |
> | computeUVOffsets + createMatrixShaderMaterial (matrix-char shader) | L472-L552 |
> | buildInstancedMesh | L554-L608 |
> | createVehicle | L610-L649 |
> | createPoliceDrone (halo-ring, searchlight, ground-disc shaders inline) | L651-L870 |
> | mergeBufferGeometries | L872-L923 |
> | Geometry detail helpers (building-box → roof-details) | L925-L1330 |
> | buildCity (orchestrator) | L1332-L1426 |
> | buildPoliceDrones + patrol routes | L1428-L1517 |
> | buildGroundGrid (+ ground-grid shader, stream sprites) | L1519-L1608 |
> | buildRain (+ rain shader) | L1610-L1683 |
> | buildHazeLayers (+ haze shader) | L1685-L1772 |
> | buildStarfield | L1774-L1809 |
> | buildLightBeams (core, halo, char-stream shaders inline) | L1811-L1953 |
> | startDroneFlythrough + nested fly() loop | L1955-L2096 |
> | `animate()` — render loop with all subsystem updates | L2098-L2347 |
> | onResize | L2350-L2355 |
> | Bootstrap try/catch (loading/error DOM handling) | L2358-L2368 |
> | PiP overlay CSS + HTML containers | L2371-L2699 |
> | PiP overlay IIFE (drag, resize, zoom, pan logic) | L2701-L2773 |

### Phase 0 — Tooling Setup

| File | Purpose |
|------|---------|
| `tsconfig.json` | Strict mode, ESNext target, moduleResolution bundler, include `src/`, paths for `three` aliases |
| `package.json` | Dependencies: `three@0.160.0`. Dev deps: `typescript`, `@biomejs/biome` (pinned with `-E`). **No Vite** — Bun is the runtime + bundler |
| `src/server.ts` | Thin `Bun.serve` wrapper that serves `index.html` via HTML import. Run with `bun --hot src/server.ts` for HMR dev, or serve static files in production |
| `biome.json` | Formatter + linter config — extends defaults, includes `src/`, targets TS modules |

**Why Bun over Vite:**
- **No config file** — Bun executes TypeScript natively; no `vite.config.ts` needed
- **HTML imports** — `import index from "./index.html"` bundles the frontend on-demand in dev (HMR) and pre-bundles in production (`bun build --target=bun`)
- **No importmap** — Bun resolves ESM natively, including `three/addons/...` paths
- **Single toolchain** — same runtime for dev server, bundling, and production

### Phase 1 — Project Skeleton & Types

```
src/
  main.ts              # Entry: init(), animate(), onResize(), bootstrap try/catch
  globals.d.ts         # Window global declarations (_matrixInstancedMesh, _rain, etc.)
  types.ts             # Custom interfaces (userData shapes, building metadata)
  constants.ts         # GRID, CELL, BUILDING_WIDTH, CHARS, ATLAS_*, MAX_CACHE_SIZE, etc.
```

**`globals.d.ts`** — Declare all `window._*` references as typed globals so TS stops complaining:

> **Note**: `_windowMeshes` is actually `THREE.InstancedMesh[]`, not `THREE.Mesh[]`. The current `globals.d.ts` has this correct.

```typescript
interface CustomWindow extends Window {
  _matrixInstancedMesh?: THREE.InstancedMesh;
  _rain?: THREE.Points;
  _groundPlane?: THREE.Mesh;
  _lightBeams?: THREE.Group[];
  _hazeLayers?: THREE.Object3D[];
  _streamSprites?: THREE.Sprite[];
  _vehicles?: THREE.Object3D[];
  _policeDrones?: THREE.Group[];
  _windowMeshes?: THREE.InstancedMesh[];
  _antennaGroups?: THREE.Group[];
  _camLight?: THREE.PointLight;
}
declare const window: CustomWindow;
```

**`constants.ts`** — All module-level constants and derived values:

| Constant | Source (test.html) |
|----------|-------------------|
| `GRID = 16` | L68 |
| `CELL = 4.2` | L69 |
| `BUILDING_WIDTH = 3.6` | L70 |
| `CHARS` string (digits + latin + katakana + symbols) | L84-L88 |
| `charToIndex: Map<string, number>` | L91 |
| `randChar(): string` function | L92-L93 |
| `ATLAS_COLS = 32`, `ATLAS_ROWS = 16` | L101-L102 |
| `CELL_SIZE = 128` | L103 |
| `MAX_CACHE_SIZE = 512` | L169 |

**`types.ts`** — Typed interfaces for userData and building metadata:

```typescript
// Building height record (L344: buildingHeights array)
export interface BuildingHeight {
  x: number;
  z: number;
  h: number;
}

// Vehicle userData shape (L625-L630)
export interface VehicleUserData {
  flyAxis: 'x' | 'z';
  flySpeed: number;
  flyDir: number;
  flyY: number;
}

// Police drone userData shape (L864-L867)
export interface DroneUserData {
  haloMat?: THREE.ShaderMaterial;
  beamMat?: THREE.ShaderMaterial;
  discMat?: THREE.ShaderMaterial;
  spotLight?: THREE.PointLight;
  curve?: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
  dir: number;
  blinkPhase: number;
}

// Stream sprite userData shape (L1590-L1592)
export interface StreamSpriteData {
  streamSpeed: number;
  streamDir: number;
  streamAxis: 'x' | 'z';
}

// Antenna blink light userData (L1173-L1174)
export interface BlinkLightData {
  blinkSpeed: number;
  blinkPhase: number;
}
```

### Phase 2 — Shader Extraction (GLSL → typed modules)

> **Important**: All shaders in `test.html` are inline string literals embedded inside function bodies. They must be extracted as standalone template literal exports.

Each shader becomes a module exporting the GLSL strings + the uniform/interface shape:

| Module | Source location in test.html |
|--------|-----------------------------|
| `matrix-char.ts` | L481-L552 (`createMatrixShaderMaterial()`) |
| `vignette.ts` | L248-L296 (inline object in `init()`) |
| `window-grid.ts` | L1030-L1078 (inside `addWindowGrid()`) |
| `rain.ts` | L1625-L1668 (inside `buildRain()`) |
| `haze.ts` | L1710-L1764 (inside `buildHazeLayers()`) |
| `ground-grid.ts` | L1530-L1569 (inside `buildGroundGrid()`) |
| `light-beam/core.ts` | L1820-L1852 (inside `buildLightBeams()`) |
| `light-beam/halo.ts` | L1854-L1879 (inside `buildLightBeams()`) |
| `light-beam/char-stream.ts` | L1881-L1906 (inside `buildLightBeams()`) |
| `police-drone/halo-ring.ts` | L665-L712 (inside `createPoliceDrone()`) |
| `police-drone/searchlight.ts` | L714-L803 (inside `createPoliceDrone()`) |
| `police-drone/ground-disc.ts` | L805-L862 (inside `createPoliceDrone()`) |

```
src/shaders/
  matrix-char.ts       # vertexShader + fragmentShader for building-face glyphs
  vignette.ts          # Post-processing vignette/color grading
  window-grid.ts       # Window flicker shader
  rain.ts              # Digital rain particle shader
  haze.ts              # Noise-based haze layer shader
  ground-grid.ts       # Ground grid line shader
  light-beam/
    core.ts            # Core beam shader
    halo.ts            # Halo glow shader
    char-stream.ts     # Character stream plane shader
  police-drone/
    halo-ring.ts       # Red-blue rotating halo
    searchlight.ts     # Volumetric scanner beam
    ground-disc.ts     # Ground-level scan disc
```

Each file exports:
```typescript
export const vertexShader = `...`;
export const fragmentShader = `...`;
// Optional: uniform type for compile-time safety
export interface MyUniforms { uTime: THREE.UniformNumber; ... }
```

### Phase 3 — Texture Utilities ✅ VERIFIED

```
src/textures/
  atlas.ts             # buildTextureAtlas(), buildCharStreamTexture()
  char-texture.ts      # makeCharTexture(), getCharTex() + texCache
```

These are self-contained canvas→texture factories. Straight extraction with `CanvasRenderingContext2D` types.

**Verification (2026-05-26)**: Compared against test.html L107-L223. All functions match exactly:
- `buildTextureAtlas()` — same canvas setup, loop logic, shadow config, texture filters
- `buildCharStreamTexture()` — same cols/rows (16×2), nested loops, `wrapT = RepeatWrapping`
- `getCharTex()` — same cache key format, eviction logic. Added null-check guard (improvement)
- `makeCharTexture()` — same radial gradient, shadow blur values, font size defaults

### Phase 4 — City Generation ✅ VERIFIED (bugs fixed in instanced-mesh.ts)

```
src/city/
  helpers.ts           # calcBuildingHeight, isRoadCell, fillChance, charSpacingForDist,
                       # floorSkipForDist, glyphBrightness, pushGlyph, addWallChars, addRoofChars
  geometry/
    building-box.ts    # createBuildingBox()
    window-grid.ts     # addWindowGrid()
    doors.ts           # addDoors()
    antenna.ts         # addAntenna()
    satellite-dish.ts  # addSatelliteDish()
    roof-details.ts    # addRoofDetails()
  instanced-mesh.ts    # buildInstancedMesh(), computeUVOffsets(), createMatrixShaderMaterial()
  merge-geometries.ts  # mergeBufferGeometries()
  city-builder.ts      # buildCity() — orchestrates all of the above
```

**Verification (2026-05-26)**: Compared all files against test.html L346-L1426.

| File | Status | Notes |
|------|--------|-------|
| `helpers.ts` | ✅ Exact match | All 10 functions. Added `charIdx === undefined` guard (original only checked `< 0`) |
| `geometry/building-box.ts` | ✅ Exact match | test.html L925-L1003 |
| `geometry/window-grid.ts` | ✅ Exact match | test.html L1030-L1046 + update function from L2317-L2322 |
| `geometry/doors.ts` | ✅ Exact match | test.html L1080-L1143 |
| `geometry/antenna.ts` | ✅ Exact match | test.html L1145-L1207 + update function from L2324-L2332 |
| `geometry/satellite-dish.ts` | ✅ Exact match | test.html L1209-L1273 |
| `geometry/roof-details.ts` | ✅ Exact match | test.html L1275-L1330 |
| `merge-geometries.ts` | ✅ Exact match | Uses `instanceof THREE.Group` instead of `obj.isGroup` — functionally equivalent |
| `city-builder.ts` | ✅ Exact match | `_createVehicle()` and `_buildPoliceDrones()` are intentional Phase 5 placeholders |
| **`instanced-mesh.ts`** | ⚠️ Fixed | See Fix Log above — 5 bugs in `updateMatrixMesh()`, 1 bug in `computeUVOffsets()` |

**Key typing work here:**
- `buildingHeights` array → `Array<{ x: number; z: number; h: number }>`
- `userData` on meshes → typed interfaces in `types.ts`
- `pushGlyph` helper → takes typed arrays as params

### Phase 5 — Vehicles & Drones ✅ VERIFIED

```
src/vehicles/
  vehicle.ts           # createVehicle() + updateVehicles()
  police-drone.ts      # createPoliceDrone() (imports shaders from src/shaders/police-drone/)
  drone-manager.ts     # buildPoliceDrones() + patrol route logic + updateDrones()
```

**Verification (2026-05-26)**: Compared against test.html L590-L870, L1428-L1517, L2192-L2280.
| File | Status | Notes |
|------|--------|-------|
| `vehicle.ts` | ✅ Exact match | createVehicle() + updateVehicles(). Vehicle userData typed as `VehicleUserData` |
| `police-drone.ts` | ✅ Exact match | Imports 3 police-drone shaders. Body, dome, halo ring, searchlight beam, ground disc, point light |
| `drone-manager.ts` | ✅ Exact match | makePatrolPath() helper + 3 patrol routes + updateDrones() with proximity detection |

### Phase 6 — Scene Effects ✅ VERIFIED

```
src/effects/
  ground-grid.ts       # buildGroundGrid() + updateGroundGrid() + updateStreamSprites()
  rain.ts              # buildRain() + updateRain()
  haze-layers.ts       # buildHazeLayers() + updateHazeLayers()
  starfield.ts         # buildStarfield() (static, no update)
  light-beams.ts       # buildLightBeams() + updateLightBeams()
```

**Verification (2026-05-26)**: Compared against test.html L1519-L1953.
| File | Status | Notes |
|------|--------|-------|
| `ground-grid.ts` | ✅ Exact match | Ground plane shader, road edge lines, 150 stream sprites |
| `rain.ts` | ✅ Exact match | 6000 particles with velocity attribute |
| `haze-layers.ts` | ✅ Exact match | 3 layers at y=5/17/29. Fixed: collect meshes directly instead of scene.children filter (TS type safety) |
| `starfield.ts` | ✅ Exact match | 800 points on hemisphere, green/blue mix |
| `light-beams.ts` | ✅ Exact match | Imports 3 light-beam shaders + charStreamTex. Core cylinder, halo cylinder, 4 char-stream planes per beam |

### Phase 7 — Camera System ✅ VERIFIED

```
src/camera/
  flythrough.ts        # startDroneFlythrough() + nested fly() loop, manual steering state,
                       # createSteerButton() DOM wiring
```

**Verification (2026-05-26)**: Compared against test.html L1955-L2096, L328-L340.
| Feature | Status | Notes |
|---------|--------|-------|
| `startDroneFlythrough()` | ✅ Exact match | 7-segment patrol path, curve flythrough with banking, RAF loop |
| Manual steering | ✅ Exact match | freePos/Yaw/Pitch/Speed encapsulated as module-level state. World bound bounce on all axes |
| `createSteerButton()` | ✅ Exact match | Dynamically creates button, toggles manualSteering, captures camera position/direction |

### Phase 8 — PiP Overlay ✅ VERIFIED

```
src/ui/
  pip-overlay.ts       # Extract the IIFE into a proper class/module with typed DOM refs
```

**Verification (2026-05-26)**: Compared against test.html L2371-L2773.
| Feature | Status | Notes |
|---------|--------|-------|
| Drag via header | ✅ Exact match | WeakMap state instead of DOM node properties. z-index bring-to-front preserved |
| Resize via corner handle | ✅ Exact match | MIN_W/H (200/150), MAX_W/H (960×540), `setCapture` for iframe event capture |
| Minimize / Restore | ✅ Exact match | Toggles `.minimized` class, button text −/+ |
| Close | ✅ Exact match | Sets `display: none` |
| Zoom toggle + pan arrows | ✅ Exact match | `scale(2)` transform, pan step = wrapper width × 0.04 |
| Shared mousemove/mouseup | ✅ Exact match | Global handlers iterate all containers |

**Improvements over original IIFE:**
- State stored in `WeakMap<HTMLDivElement, DragState>` / `ResizeState` instead of ad-hoc `_dragging`, `_dragX` properties on DOM nodes
- All `querySelector` calls null-guarded (no non-null assertions)
- Exported `initPiPOverlay()` for explicit initialization; auto-init on module load

### Phase 9 — Wire It All Together ✅ VERIFIED

**`src/main.ts`** becomes the orchestrator:

```typescript
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// ... imports

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;
const clock = new THREE.Clock();

export function init() { /* scene setup, calls buildCity(), etc. */ }
export function animate() { /* render loop — delegates to subsystem update functions */ }
function onResize() { /* ... */ }

// Bootstrap (L2358-L2368)
try {
  init();
  animate();
} catch (e) {
  // Hide loading overlay, show error div with message
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  const errorEl = document.getElementById('error');
  if (errorEl) {
    errorEl.textContent = `ERROR: ${e.message}`;
    errorEl.style.display = 'block';
  }
  console.error('Matrix City initialization failed:', e);
}
```

**`animate()` decomposition**: The current `animate()` loop (L2098-L2347) has ~120 lines updating all subsystems. Instead of keeping this monolithic, each module exports an `update(dt: number, elapsed: number)` function:

| Subsystem | Update logic in test.html | Target module |
|-----------|--------------------------|---------------|
| Matrix instanced mesh (char refresh/decay) | L2105-L2148 | `src/city/instanced-mesh.ts` → `updateMatrixMesh(dt, elapsed)` |
| Ground grid time uniform | L2151-L2153 | `src/effects/ground-grid.ts` → `updateGroundGrid(elapsed)` |
| Rain (position + time) | L2155-L2168 | `src/effects/rain.ts` → `updateRain(dt, elapsed)` |
| Light beams (rotation, height pulse, uniforms) | L2170-L2183 | `src/effects/light-beams.ts` → `updateLightBeams(dt, elapsed)` |
| Haze layers (time uniform) | L2186-L2190 | `src/effects/haze-layers.ts` → `updateHazeLayers(elapsed)` |
| Vehicles (position, altitude bob) | L2192-L2214 | `src/vehicles/vehicle.ts` → `updateVehicles(dt, elapsed)` |
| Police drones (curve follow, proximity, uniforms) | L2216-L2280 | `src/vehicles/drone-manager.ts` → `updateDrones(cameraPos, dt, elapsed)` |
| Stream sprites (position, opacity pulse, char swap) | L2283-L2314 | `src/effects/ground-grid.ts` → `updateStreamSprites(dt, elapsed)` |
| Window grid time uniforms | L2317-L2322 | `src/city/geometry/window-grid.ts` → `updateWindowMeshes(elapsed)` |
| Antenna blink lights | L2324-L2332 | `src/city/geometry/antenna.ts` → `updateAntennas(elapsed)` |
| Camera-following point light | L2335-L2338 | handled in `main.ts` (trivial) |

Each `animate()` call becomes:
```typescript
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  updateMatrixMesh(dt, t);
  updateGroundGrid(t);
  updateRain(dt, t);
  // ... etc

  if (window._camLight) window._camLight.position.copy(camera.position);
  composer.render();
}
```

### Phase 10 — HTML Shell + Server

`index.html` becomes a thin shell served by `src/server.ts`:

**`index.html`**:
- `<style>` block (unchanged, or extracted to `src/style.css`)
- **No importmap** — Bun resolves ESM natively
- `<script type="module" src="/src/main.ts">`
- PiP HTML containers (unchanged)
- `<script type="module" src="/src/ui/pip-overlay.ts">`

- Dev: `bun --hot src/server.ts` — HMR for frontend changes, no full reload
- Prod: `bun build --target=bun src/server.ts` — pre-bundles all assets into a single deployable file

### Migration Strategy — Step by Step

1. **Scaffold** ✅ — Created `package.json`, `tsconfig.json`, empty `src/` structure, `src/server.ts`
2. **Extract constants + types first** ✅ — Zero dependencies, easy wins (L68-L93, L101-L103, 169)
3. **Extract shaders** ✅ — Pure string exports, trivial migration (see Phase 2 line reference table above). 12 modules extracted.
4. **Extract textures** ✅ — Self-contained canvas functions (L105-L193). Verified against test.html.
5. **Extract city helpers → geometry details → instanced mesh → city builder** ✅ — Bottom-up following the dependency chain (L346-L1426). **Bugs found and fixed in `instanced-mesh.ts`** (see Fix Log).
6. **Extract effects** ✅ — All 5 modules: ground-grid, rain, haze-layers, starfield, light-beams (L1519-L1953)
7. **Extract vehicles/drones** ✅ — vehicle.ts, police-drone.ts, drone-manager.ts with real imports replacing stubs (L610-L870, L1428-L1517)
8. **Extract camera flythrough + steer button** ✅ — Encapsulated steering state + DOM wiring in `flythrough.ts` (L74-L82, L328-L340, L1955-L2096)
9. **Wire main.ts** ✅ Done — init() builds all subsystems; animate() delegates to 9 update functions across modules
10. **Extract PiP overlay** ✅ Done — `pip-overlay.ts` with WeakMap state management, typed interfaces (`DragState`, `ResizeState`), null-safe DOM queries (L2371-L2773)

### Key Decisions / Trade-offs

| Decision | Rationale |
|----------|-----------|
| Keep `window._*` globals for now | Minimal behavioral change; can refactor to proper state management later |
| GLSL as template literal exports | No need for a separate shader build step; keeps it simple |
| Bun as runtime + bundler | Native TS execution, HTML imports with HMR via `bun --hot`, zero config — no Vite or Webpack needed |
| One `globals.d.ts` instead of refactoring globals | Fast migration path; proper encapsulation is a follow-up |
| Bun.serve for dev + prod | Dev: on-demand bundling with HMR. Prod: `bun build --target=bun` pre-bundles everything into a single file |