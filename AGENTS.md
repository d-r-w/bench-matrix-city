# bench-matrix-city — Project Instructions

## Stack & Tooling

- **Runtime**: Bun (native TS execution, HTML imports with HMR via `bun --hot`)
- **3D engine**: three@0.160.0
- **Language**: TypeScript strict mode, ESNext target, moduleResolution bundler
- **Lint/format**: @biomejs/biome@2.4.0 — double quotes, 2-space indent, 100-char line width, trailing commas es5, arrow parens always, `useImportType` off
- **No Vite/Webpack** — Bun handles dev server, bundling, and ESM resolution (including `three/addons/...`)

## Commands

- `bun run dev` — Dev server with HMR on port 3000 (`bun run --hot src/server.ts`)
- `bun run build` — Production bundle into `dist/` (`bun build --target=bun src/server.ts --outdir dist`)
- `bun run check` — Biome lint/format + TypeScript type-check

## Migration Context

All application logic currently lives in `index.html`. The goal is to extract it into the TypeScript module structure below. Do not modify `index.html` beyond removing extracted sections and updating script imports.

### Extraction Order (follow dependency chain)

1. **Constants & types** — `src/constants.ts`, `src/types.ts`, `src/globals.d.ts` (zero dependencies)
2. **Shaders** — GLSL as template literal exports (`vertexShader` + `fragmentShader`) with optional typed uniform interfaces in `src/shaders/`
3. **Textures** — Canvas→texture factories in `src/textures/`
4. **City generation** (bottom-up): helpers → geometry details → instanced mesh → city builder in `src/city/`
5. **Effects** — Each independent once shaders are extracted, into `src/effects/`
6. **Vehicles & drones** — Depends on police-drone shaders, into `src/vehicles/`
7. **Camera flythrough** — Encapsulate manualSteering, mouseNDC, freePos/Yaw/Pitch/Speed in `src/camera/flythrough.ts`
8. **Wire main.ts** — Import everything, verify with `bun run dev`
9. **PiP overlay** — Already extracted to `src/ui/pip-overlay.ts`

### Target Structure

```
src/
  server.ts              # Bun.serve — serves index.html (done)
  main.ts                # Orchestrator: init(), animate(), onResize()
  style.css              # Styles from index.html <style> block
  globals.d.ts           # window._* typed declarations (keep globals for now, refactor later)
  types.ts               # Custom interfaces (userData shapes, building metadata)
  constants.ts           # GRID, CELL, BUILDING_WIDTH, CHARS, ATLAS_*, MAX_CACHE_SIZE
  shaders/               # GLSL template literal exports + uniform type interfaces
    matrix-char.ts       # Building-face glyphs
    vignette.ts          # Post-processing vignette/color grading
    window-grid.ts       # Window flicker
    rain.ts              # Digital rain particles
    haze.ts              # Noise-based haze layers
    ground-grid.ts       # Ground grid lines
    light-beam/          # core.ts, halo.ts, char-stream.ts
    police-drone/        # halo-ring.ts, searchlight.ts, ground-disc.ts
  textures/              # atlas.ts (buildTextureAtlas, buildCharStreamTexture), char-texture.ts (makeCharTexture, getCharTex + texCache)
  city/                  # helpers.ts, instanced-mesh.ts, merge-geometries.ts, city-builder.ts
    geometry/            # building-box.ts, window-grid.ts, doors.ts, antenna.ts, satellite-dish.ts, roof-details.ts
  vehicles/              # vehicle.ts, police-drone.ts, drone-manager.ts
  effects/               # ground-grid.ts, rain.ts, haze-layers.ts, starfield.ts, light-beams.ts
  camera/                # flythrough.ts (startDroneFlythrough + manual steering state)
  ui/                    # pip-overlay.ts (done)

index.html               # Thin shell — <style>, script src="/src/main.ts", PiP containers
```

## Conventions

- **ESM throughout** — All modules use ES imports/exports. Bun resolves natively, no importmap needed.
- **GLSL as template literals** — No separate shader build step. Export `vertexShader` + `fragmentShader` strings per file.
- **`window._*` globals kept for now** — Declare in `globals.d.ts`. Proper state management is a follow-up refactor.
- **City typing**: `buildingHeights` → `Array<{ x: number; z: number; h: number }>`, mesh `userData` → typed interfaces from `types.ts`.
