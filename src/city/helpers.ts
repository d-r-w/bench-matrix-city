// City generation helpers (test.html L348-L470)
import { BUILDING_WIDTH, charToIndex, randChar } from "../constants.js";

/** Calculate building height based on grid position distance from center. */
export function calcBuildingHeight(gx: number, gz: number): number {
  const dist = Math.sqrt(gx * gx + gz * gz);
  let maxH = Math.max(5, 48 - dist * 1.5);
  maxH += (Math.random() - 0.5) * 12;
  // Create landmark skyscrapers near center
  if (dist < 4 && Math.random() > 0.5) maxH = Math.floor(maxH * 1.6);
  return Math.floor(maxH);
}

/** Check if a grid cell is a road (even indices form the road grid). */
export function isRoadCell(gx: number, gz: number): boolean {
  return gx % 2 === 0 || gz % 2 === 0;
}

/** Probability of placing a building at given distance from center. */
export function fillChance(dist: number): number {
  return Math.max(0.35, 0.7 - dist * 0.04);
}

/** Character spacing on building faces based on distance from center. */
export function charSpacingForDist(dist: number): number {
  return Math.max(0.3, 0.28 + dist * 0.01);
}

/** How many floors to skip between glyph rows based on distance. */
export function floorSkipForDist(dist: number): number {
  return dist < 6 ? 1 : dist < 10 ? 2 : 3;
}

/** Brightness factor for a glyph based on face direction and floor height. */
export function glyphBrightness(faceSign: number, floorH: number, maxH: number): number {
  let shadow = 1.0;
  if (faceSign === -1) shadow *= 0.6; // back/left faces darker
  if (floorH < maxH * 0.2) shadow *= 0.7; // lower floors slightly darker
  return Math.random() > 0.6 ? shadow : shadow * 0.45;
}

/** Push a single glyph record into the three parallel arrays. */
export function pushGlyph(
  positions: number[],
  charIndices: number[],
  brightFlags: number[],
  px: number,
  py: number,
  pz: number,
  chIdx: number,
  bright: number
): void {
  positions.push(px, py, pz);
  charIndices.push(chIdx);
  brightFlags.push(bright);
}

/** Add Matrix character glyphs to all four faces of a building. */
export function addWallChars(
  positions: number[],
  charIndices: number[],
  brightFlags: number[],
  bx: number,
  bz: number,
  maxH: number,
  dist: number
): void {
  const hw = BUILDING_WIDTH / 2;
  const spacing = charSpacingForDist(dist);
  const charsOnEdge = Math.floor((hw * 2) / spacing);
  const floorSkip = floorSkipForDist(dist);

  const faceDefs = [
    { axis: "x" as const, sign: -1 },
    { axis: "x" as const, sign: 1 },
    { axis: "z" as const, sign: -1 },
    { axis: "z" as const, sign: 1 },
  ];

  for (const face of faceDefs) {
    for (let i = 0; i < charsOnEdge; i++) {
      const pos = (i - charsOnEdge / 2 + 0.5) * spacing;

      for (let h = 1; h <= maxH; h += floorSkip) {
        if (Math.random() < 0.12) continue; // organic gaps

        const ch = randChar();
        const charIdx = charToIndex.get(ch);
        if (charIdx === undefined || charIdx < 0) continue;

        const bright = glyphBrightness(face.sign, h, maxH);

        let px: number;
        let pz: number;
        if (face.axis === "x") {
          px = bx + pos;
          pz = bz + face.sign * hw;
        } else {
          px = bx + face.sign * hw;
          pz = bz + pos;
        }

        pushGlyph(positions, charIndices, brightFlags, px, h * 0.32, pz, charIdx, bright);
      }
    }
  }
}

/** Add Matrix character glyphs around the roof perimeter of a building. */
export function addRoofChars(
  positions: number[],
  charIndices: number[],
  brightFlags: number[],
  bx: number,
  bz: number,
  maxH: number,
  dist: number
): void {
  const hw = BUILDING_WIDTH / 2;
  const spacing = charSpacingForDist(dist);
  const roofY = maxH * 0.32;
  const charsOnEdge = Math.floor((hw * 2) / spacing);

  for (let i = 0; i < charsOnEdge; i++) {
    const pos = (i - charsOnEdge / 2 + 0.5) * spacing;

    // Two edges parallel to z-axis (varying x, fixed z at ±hw)
    for (const sign of [-1, 1]) {
      const ch = randChar();
      const charIdx = charToIndex.get(ch);
      if (charIdx === undefined || charIdx < 0) continue;

      pushGlyph(positions, charIndices, brightFlags, bx + pos, roofY, bz + sign * hw, charIdx, 1.0);
    }

    // Two edges parallel to x-axis (fixed x at ±hw, varying z)
    for (const sign of [-1, 1]) {
      const ch = randChar();
      const charIdx = charToIndex.get(ch);
      if (charIdx === undefined || charIdx < 0) continue;

      pushGlyph(positions, charIndices, brightFlags, bx + sign * hw, roofY, bz + pos, charIdx, 1.0);
    }
  }
}
