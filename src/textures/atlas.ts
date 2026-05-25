import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, CELL_SIZE, CHARS } from "../constants.js";

/** Build the main character texture atlas (test.html L127-L165). */
export function buildTextureAtlas(): {
  texture: THREE.CanvasTexture;
  cols: number;
  rows: number;
} {
  const w = ATLAS_COLS * CELL_SIZE;
  const h = ATLAS_ROWS * CELL_SIZE;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for atlas canvas");

  ctx.shadowColor = "#00ff41";

  for (let i = 0; i < CHARS.length; i++) {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);

    if (i >= ATLAS_COLS * ATLAS_ROWS) break;

    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;

    const bright = i < CHARS.length / 2;
    ctx.shadowBlur = bright ? 8 : 4;

    ctx.fillStyle = bright ? "#55ff77" : "#00dd44";
    ctx.font = `${CELL_SIZE * 0.7}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(CHARS[i], x, y + 4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.flipY = false;
  tex.generateMipmaps = false;
  return { texture: tex, cols: ATLAS_COLS, rows: ATLAS_ROWS };
}

/** Build the character stream texture for light-beam char-stream planes (test.html L107-L125). */
export function buildCharStreamTexture(): THREE.CanvasTexture {
  const cols = 16;
  const rows = 2;
  const w = cols * CELL_SIZE;
  const h = rows * CELL_SIZE;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for char-stream canvas");

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      const x = col * CELL_SIZE + CELL_SIZE / 2;
      const y = row * CELL_SIZE + CELL_SIZE / 2 + 4;

      ctx.shadowColor = "#00ff41";
      ctx.shadowBlur = 6;
      ctx.fillStyle = "#55ff77";
      ctx.font = `${CELL_SIZE * 0.7}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, x, y);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapT = THREE.RepeatWrapping;
  tex.flipY = false;
  tex.generateMipmaps = false;
  return tex;
}
