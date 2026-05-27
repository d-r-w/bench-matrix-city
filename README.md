# bench-matrix-city

A Matrix-inspired 3D city visualization with flying camera, police drones, digital rain, and CRT-style post-processing. Built with Three.js on Bun.

## Running

```bash
bun run dev       # Dev server with HMR on port 3000
bun run build     # Production bundle into dist/
bun run check     # Lint + type-check
```

## Stack

- **Runtime**: Bun (native TS, HTML imports, no bundler config)
- **3D engine**: three@0.160.0
- **Language**: TypeScript strict mode, ESNext target
- **Lint/format**: @biomejs/biome@2.4.0

## Structure

The project was extracted from a single, 2,700-line `test.html` file into a modular TypeScript structure under `src/`. Key areas:

| Directory | Contents |
|-----------|----------|
| `shaders/` | GLSL as template literal exports (matrix chars, rain, haze, vignette, etc.) |
| `textures/` | Canvas-based texture factories and atlas builders |
| `city/` | Building geometry helpers, instanced mesh generation, city builder |
| `vehicles/` | Cars and police drones with patrol routes |
| `effects/` | Ground grid, rain particles, haze layers, starfield, light beams |
| `camera/` | Flythrough system with manual steering controls |
| `ui/` | PiP overlay (drag, resize, zoom, pan) |

This refactor was performed by Qwen3.6 27B MTP in [pi.dev's](https://pi.dev) coding agent harness.

See `refactor_plan.md` for the full extraction history and fix log.

## ❤️
- [TypeScript](https://github.com/microsoft/TypeScript) — type-safe JavaScript
- [Bun](https://github.com/oven-sh/bun) — runtime, dev server, bundler
- [Three.js](https://github.com/mrdoob/three.js) — 3D rendering engine
- [@biomejs/biome](https://github.com/biomejs/biome) — linting and formatting
- [pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) — coding agent harness
- [Qwen3.6-27B](https://huggingface.co/Qwen/Qwen3.6-27B) — base model by Alibaba Qwen
- [Qwen3.6-27B-MTP-GGUF](https://huggingface.co/unsloth/Qwen3.6-27B-MTP-GGUF) — MTP GGUF quantization by Unsloth
- [LM Studio](https://github.com/lmstudio-ai) — local inference runtime
