// Combat telemetry HUD — tracks shots fired, drones neutralized, structural impacts

const PANEL_ID = "combat-telemetry";

interface Stats {
  shotsFired: number;
  dronesHit: number;
  buildingsHit: number;
}

const stats: Stats = {
  shotsFired: 0,
  dronesHit: 0,
  buildingsHit: 0,
};

// DOM references (set once during init)
let panelEl: HTMLElement | null = null;
let shotsEl: HTMLElement | null = null;
let dronesPctEl: HTMLElement | null = null;
let dronesBarEl: HTMLElement | null = null;
let buildingsPctEl: HTMLElement | null = null;
let buildingsBarEl: HTMLElement | null = null;

// ── Public API ────────────────────────────────────────────────

/** Call once during app init to create the HUD panel. */
export function buildCombatTelemetry(): void {
  const existing = document.getElementById(PANEL_ID);
  if (existing) return; // already built

  try {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="ct-header">◈ COMBAT TELEMETRY ◈</div>
      <div class="ct-row">
        <span class="ct-label">SHOTS FIRED</span>
        <span class="ct-value ct-shots" id="ct-shots">0</span>
      </div>
      <div class="ct-divider"></div>
      <div class="ct-section">
        <div class="ct-row">
          <span class="ct-label">TARGETS NEUTRALIZED</span>
          <span class="ct-value ct-drones-pct" id="ct-drones-pct">0.0%</span>
        </div>
        <div class="ct-bar-track">
          <div class="ct-bar-fill ct-bar-green" id="ct-drones-bar"></div>
        </div>
      </div>
      <div class="ct-section">
        <div class="ct-row">
          <span class="ct-label">STRUCTURAL IMPACTS</span>
          <span class="ct-value ct-buildings-pct" id="ct-buildings-pct">0.0%</span>
        </div>
        <div class="ct-bar-track">
          <div class="ct-bar-fill ct-bar-red" id="ct-buildings-bar"></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Cache DOM refs for fast per-frame updates
    panelEl = panel;
    shotsEl = document.getElementById("ct-shots");
    dronesPctEl = document.getElementById("ct-drones-pct");
    dronesBarEl = document.getElementById("ct-drones-bar");
    buildingsPctEl = document.getElementById("ct-buildings-pct");
    buildingsBarEl = document.getElementById("ct-buildings-bar");
  } catch (e) {
    console.error("[CombatTelemetry] Failed to build HUD panel:", e);
  }
}

/** Record a shot being fired. */
export function recordShot(): void {
  stats.shotsFired++;
}

/** Record a drone being destroyed by laser fire. */
export function recordDroneHit(): void {
  stats.dronesHit++;
}

/** Record a building being struck by laser fire. */
export function recordBuildingHit(): void {
  stats.buildingsHit++;
}

/** Update the HUD display — call each frame or on stat change. */
export function updateCombatTelemetry(): void {
  if (!panelEl || !shotsEl) return;

  const total = stats.shotsFired;
  const dronePct = total > 0 ? (stats.dronesHit / total) * 100 : 0;
  const buildingPct = total > 0 ? (stats.buildingsHit / total) * 100 : 0;

  shotsEl.textContent = String(total);

  if (dronesPctEl) dronesPctEl.textContent = `${dronePct.toFixed(1)}%`;
  if (buildingsPctEl) buildingsPctEl.textContent = `${buildingPct.toFixed(1)}%`;

  // Animate bars with a subtle glow pulse on update
  if (dronesBarEl) {
    dronesBarEl.style.width = `${Math.min(dronePct, 100)}%`;
    dronesBarEl.classList.add("ct-bar-pulse");
    requestAnimationFrame(() => dronesBarEl?.classList.remove("ct-bar-pulse"));
  }

  if (buildingsBarEl) {
    buildingsBarEl.style.width = `${Math.min(buildingPct, 100)}%`;
    buildingsBarEl.classList.add("ct-bar-pulse");
    requestAnimationFrame(() => buildingsBarEl?.classList.remove("ct-bar-pulse"));
  }
}

/** Reset all counters and clear the display. */
export function resetCombatTelemetry(): void {
  stats.shotsFired = 0;
  stats.dronesHit = 0;
  stats.buildingsHit = 0;
  updateCombatTelemetry();
}
