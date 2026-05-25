import * as THREE from "three";
import { MAX_CACHE_SIZE } from "../constants.js";

/** Options for makeCharTexture / getCharTex. */
export interface CharTextureOpts {
  bright?: boolean;
  size?: number;
}

const texCache = new Map<string, THREE.CanvasTexture>();

/** Get a cached single-character texture (test.html L183-L192). */
export function getCharTex(char: string, opts: CharTextureOpts): THREE.CanvasTexture {
  const key = `${char}_${opts.bright ? "B" : "N"}_${opts.size || 90}`;
  if (!texCache.has(key)) {
    while (texCache.size >= MAX_CACHE_SIZE) {
      const firstKey = texCache.keys().next().value as string;
      texCache.delete(firstKey);
    }
    texCache.set(key, makeCharTexture(char, opts));
  }
  const cached = texCache.get(key);
  if (!cached) throw new Error(`Texture cache miss for key: ${key}`);
  return cached;
}

/** Create a single-character canvas texture with radial glow (test.html L194-L223). */
export function makeCharTexture(char: string, opts: CharTextureOpts = {}): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context for char canvas");

  const grd = ctx.createRadialGradient(64, 64, 5, 64, 64, 55);
  grd.addColorStop(0, opts.bright ? "rgba(0,255,65,0.15)" : "rgba(0,255,65,0.04)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = opts.bright ? "#55ff77" : "#00dd44";
  ctx.shadowColor = "#00ff41";
  ctx.shadowBlur = opts.bright ? 20 : 8;
  ctx.font = `${opts.size || 90}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 64, 68);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
