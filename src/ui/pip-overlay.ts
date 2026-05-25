// PiP overlay — drag, resize, zoom, pan logic (test.html L2650-L2771)

const MIN_W = 200;
const MIN_H = 150;

interface DragState {
  dragging: boolean;
  dragX: number;
  dragY: number;
}

interface ResizeState {
  resizing: boolean;
  rx: number;
  ry: number;
  sw: number;
  sh: number;
}

// ── Per-container state stored in a WeakMap to avoid polluting DOM nodes ──

const dragStates = new WeakMap<HTMLDivElement, DragState>();
const resizeStates = new WeakMap<HTMLDivElement, ResizeState>();

function setupContainer(container: HTMLElement): void {
  const header = container.querySelector(".pip-header") as HTMLDivElement;
  const resizeHandle = container.querySelector(".pip-resize-handle") as HTMLDivElement;
  const toggleBtn = container.querySelector(".pip-toggle") as HTMLButtonElement;
  const closeBtn = container.querySelector(".pip-close") as HTMLButtonElement;
  const zoomBtn = container.querySelector(".pip-zoom") as HTMLButtonElement;
  const iframeWrapper = container.querySelector(".pip-iframe-wrapper") as HTMLDivElement;
  const panArrows = container.querySelector(".pan-arrows") as HTMLDivElement;

  // Initialise state maps
  dragStates.set(header, { dragging: false, dragX: 0, dragY: 0 });
  resizeStates.set(resizeHandle, { resizing: false, rx: 0, ry: 0, sw: 0, sh: 0 });

  // ── Dragging (test.html L2658-L2671) ──────────────────────────────

  header.addEventListener("mousedown", (e: MouseEvent) => {
    if ((e.target as Node | null)?.nodeType === Node.ELEMENT_NODE) {
      if ((e.target as Element).closest(".pip-btn")) return;
    }

    const state = dragStates.get(header);
    if (!state) return;
    state.dragging = true;
    state.dragX = e.clientX - container.offsetLeft;
    state.dragY = e.clientY - container.offsetTop;
    container.style.transition = "none";

    // Bring to front
    document.querySelectorAll(".pip-container").forEach((c) => {
      (c as HTMLElement).style.zIndex = "100";
    });
    container.style.zIndex = "200";
  });

  // ── Resizing (test.html L2674-L2685) ──────────────────────────────

  resizeHandle.addEventListener("mousedown", (e: MouseEvent) => {
    const state = resizeStates.get(resizeHandle);
    if (!state) return;
    state.resizing = true;
    state.rx = e.clientX;
    state.ry = e.clientY;
    state.sw = container.offsetWidth;
    state.sh = container.offsetHeight;
    e.preventDefault();
    e.stopPropagation();

    // Capture all mouse events to this element so iframes can't steal them
    (
      resizeHandle as HTMLElement & { setCapture?: (pointerCaptureOnly?: boolean) => void }
    ).setCapture?.(true);
  });

  // ── Minimize / Restore (test.html L2688-L2697) ────────────────────

  toggleBtn.addEventListener("click", () => {
    if (container.classList.contains("minimized")) {
      container.classList.remove("minimized");
      toggleBtn.textContent = "\u2212"; // −
    } else {
      container.classList.add("minimized");
      toggleBtn.textContent = "+";
    }
  });

  // ── Close (test.html L2700-L2703) ─────────────────────────────────

  closeBtn.addEventListener("click", () => {
    container.style.display = "none";
  });

  // ── Zoom toggle — shows/hides pan arrows, applies scale (test.html L2706-L2721) ──

  zoomBtn.addEventListener("click", (_e: Event) => {
    const iframe = iframeWrapper.querySelector<HTMLIFrameElement>("iframe");
    if (!iframe) return;
    const isZoomed = iframeWrapper.classList.toggle("zoomed");
    zoomBtn.classList.toggle("active", isZoomed);
    panArrows.classList.toggle("visible", isZoomed);

    if (isZoomed) {
      // Start from center with scale + zero translate
      iframe.style.transform = "scale(2) translate(0px, 0px)";
      (iframe as HTMLIFrameElement & { _panX?: number; _panY?: number })._panX = 0;
      (iframe as HTMLIFrameElement & { _panX?: number; _panY?: number })._panY = 0;
    } else {
      iframe.style.transform = "";
      delete (iframe as HTMLIFrameElement & { _panX?: number; _panY?: number })._panX;
      delete (iframe as HTMLIFrameElement & { _panX?: number; _panY?: number })._panY;
    }
  });

  // ── Pan arrows — adjust translate offset on click (test.html L2724-L2743) ──

  panArrows.querySelectorAll(".pan-arrow").forEach((arrow: Element) => {
    const btn = arrow as HTMLButtonElement;
    btn.addEventListener("click", () => {
      const iframe = iframeWrapper.querySelector<HTMLIFrameElement>("iframe");
      if (!iframe) return;
      const typedIframe = iframe as HTMLIFrameElement & { _panX?: number; _panY?: number };
      let px = typedIframe._panX ?? 0;
      let py = typedIframe._panY ?? 0;

      // Step in px of the wrapper (content moves opposite to arrow direction)
      const step = iframeWrapper.offsetWidth * 0.04;

      if (btn.classList.contains("up")) py += step;
      if (btn.classList.contains("down")) py -= step;
      if (btn.classList.contains("left")) px += step;
      if (btn.classList.contains("right")) px -= step;

      typedIframe._panX = px;
      typedIframe._panY = py;
      iframe.style.transform = `scale(2) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    });
  });
}

// ── Shared mouse move handler for dragging & resizing (test.html L2748-L2765) ──

function handleMouseMove(e: MouseEvent): void {
  document.querySelectorAll(".pip-container").forEach((containerEl) => {
    const container = containerEl as HTMLElement;
    const header = container.querySelector<HTMLDivElement>(".pip-header");
    const resizeHandle = container.querySelector<HTMLDivElement>(".pip-resize-handle");
    if (!header || !resizeHandle) return;

    const dragState = dragStates.get(header);
    if (dragState?.dragging) {
      container.style.left = `${e.clientX - dragState.dragX}px`;
      container.style.top = `${e.clientY - dragState.dragY}px`;
      container.style.right = "auto";
      container.style.bottom = "auto";
    }

    const resizeState = resizeStates.get(resizeHandle);
    if (resizeState?.resizing) {
      const MAX_W = Math.min(960, window.innerWidth - 40);
      const MAX_H = Math.min(540, window.innerHeight - 40);
      const newW = Math.max(MIN_W, Math.min(MAX_W, resizeState.sw + (e.clientX - resizeState.rx)));
      const newH = Math.max(MIN_H, Math.min(MAX_H, resizeState.sh + (e.clientY - resizeState.ry)));
      container.style.width = `${newW}px`;
      container.style.height = `${newH}px`;
    }
  });
}

function handleMouseUp(): void {
  document.querySelectorAll(".pip-container").forEach((containerEl) => {
    const container = containerEl as HTMLElement;
    const header = container.querySelector<HTMLDivElement>(".pip-header");
    const resizeHandle = container.querySelector<HTMLDivElement>(".pip-resize-handle");
    if (!header || !resizeHandle) return;

    const dragState = dragStates.get(header);
    if (dragState) {
      dragState.dragging = false;
    }

    const resizeState = resizeStates.get(resizeHandle);
    if (resizeState) resizeState.resizing = false;
  });
}

// ── Public init — called once when DOM is ready ────────────────────────

export function initPiPOverlay(): void {
  document.querySelectorAll(".pip-container").forEach((el) => {
    setupContainer(el as HTMLElement);
  });
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
}

// Auto-initialise when the module loads (DOM is already parsed since script is at end of body)
initPiPOverlay();
