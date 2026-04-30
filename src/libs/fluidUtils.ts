import type { FluidState, MouseState, Vec2 } from "./fluidTypes";

export function indexOf(state: FluidState, x: number, y: number): number {
  return x + y * state.cols;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampX(state: FluidState, x: number): number {
  return clamp(x, 0, state.cols - 1);
}

export function clampY(state: FluidState, y: number): number {
  return clamp(y, 0, state.rows - 1);
}

export function sampleField(
  state: FluidState,
  field: Float32Array,
  x: number,
  y: number
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, state.cols - 1);
  const y1 = Math.min(y0 + 1, state.rows - 1);

  const sx = x - x0;
  const sy = y - y0;

  const i00 = indexOf(state, clampX(state, x0), clampY(state, y0));
  const i10 = indexOf(state, clampX(state, x1), clampY(state, y0));
  const i01 = indexOf(state, clampX(state, x0), clampY(state, y1));
  const i11 = indexOf(state, clampX(state, x1), clampY(state, y1));

  const a = field[i00] * (1 - sx) + field[i10] * sx;
  const b = field[i01] * (1 - sx) + field[i11] * sx;

  return a * (1 - sy) + b * sy;
}

export function toGridPosition(
  canvas: HTMLCanvasElement,
  cellSize: number,
  clientX: number,
  clientY: number
): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;

  return {
    x: Math.floor(x / cellSize),
    y: Math.floor(y / cellSize),
  };
}

export function createMouseState(): MouseState {
  return {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    down: false,
    moved: false,
    initialized: false,
  };
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

let sharedRenderCanvas: HTMLCanvasElement | undefined;
let sharedRenderCtx: CanvasRenderingContext2D | undefined;

export function getRenderBuffer(
  width: number,
  height: number,
  canvas: HTMLCanvasElement
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!sharedRenderCanvas) {
    sharedRenderCanvas = canvas.ownerDocument.createElement("canvas");
  }

  if (sharedRenderCanvas.width !== width) {
    sharedRenderCanvas.width = width;
  }

  if (sharedRenderCanvas.height !== height) {
    sharedRenderCanvas.height = height;
  }

  if (!sharedRenderCtx) {
    const ctx = sharedRenderCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("CanvasRenderingContext2D を取得できませんでした。");
    }

    sharedRenderCtx = ctx;
  }

  return {
    canvas: sharedRenderCanvas,
    ctx: sharedRenderCtx,
  };
}
