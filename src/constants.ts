// Grid & building constants (test.html L68-L70)
export const GRID = 16;
export const CELL = 4.2;
export const BUILDING_WIDTH = 3.6;

// Character set for Matrix glyphs (test.html L84-L93)
export const CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピ" +
  "ウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペ" +
  "オォコソトノホモヨョロゴゾドボポヴッン⟨⟩{}[]|/\\+=<>!@#$%&";

export const charToIndex = new Map<string, number>();
for (let i = 0; i < CHARS.length; i++) {
  charToIndex.set(CHARS[i], i);
}

export function randChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

// Texture atlas constants (test.html L101-L103)
export const ATLAS_COLS = 32;
export const ATLAS_ROWS = 16;
export const CELL_SIZE = 128;

// Character texture cache (test.html L169)
export const MAX_CACHE_SIZE = 512;
