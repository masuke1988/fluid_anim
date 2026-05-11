import type { FluidState, MouseState } from "./fluidTypes";
import {
  clamp,
  clampX,
  clampY,
  createMouseState,
  getRenderBuffer,
  indexOf,
  resizeCanvasToDisplaySize,
  sampleField,
  toGridPosition,
} from "./fluidUtils";

export function createFluidState(
  width: number,
  height: number,
  cellSize = 8
): FluidState {
  const cols = Math.max(2, Math.floor(width / cellSize));
  const rows = Math.max(2, Math.floor(height / cellSize));
  const size = cols * rows;

  return {
    cols,
    rows,
    cellSize,
    dt: 0.12,
    pressureIterations: 20,
    velocityDamping: 0.995,
    densityDamping: 0.985,
    forceScale: 12,
    densityAmount: 0.9,
    cellAlpha: new Float32Array(size),

    u: new Float32Array(size),
    v: new Float32Array(size),
    uPrev: new Float32Array(size),
    vPrev: new Float32Array(size),

    density: new Float32Array(size),
    densityPrev: new Float32Array(size),

    pressure: new Float32Array(size),
    pressurePrev: new Float32Array(size),
    divergence: new Float32Array(size),
  };
}

export function addDensity(
  state: FluidState,
  cx: number,
  cy: number,
  radius: number,
  amount: number
): void {
  const r2 = radius * radius;

  for (let y = cy - radius; y <= cy + radius; y++) {
    if (y < 1 || y >= state.rows - 1) continue;

    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 1 || x >= state.cols - 1) continue;

      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;

      if (d2 > r2) continue;

      const falloff = 1 - d2 / r2;
      const i = indexOf(state, x, y);
      state.density[i] += amount * falloff;
    }
  }
}

export function addVelocity(
  state: FluidState,
  cx: number,
  cy: number,
  radius: number,
  fx: number,
  fy: number
): void {
  const r2 = radius * radius;

  for (let y = cy - radius; y <= cy + radius; y++) {
    if (y < 1 || y >= state.rows - 1) continue;

    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 1 || x >= state.cols - 1) continue;

      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;

      if (d2 > r2) continue;

      const falloff = 1 - d2 / r2;
      const i = indexOf(state, x, y);

      state.u[i] += fx * falloff;
      state.v[i] += fy * falloff;
    }
  }
}

export function advectScalar(
  state: FluidState,
  src: Float32Array,
  dst: Float32Array
): void {
  for (let y = 1; y < state.rows - 1; y++) {
    for (let x = 1; x < state.cols - 1; x++) {
      const i = indexOf(state, x, y);

      const prevX = clampX(state, x - state.u[i] * state.dt);
      const prevY = clampY(state, y - state.v[i] * state.dt);

      dst[i] = sampleField(state, src, prevX, prevY);
    }
  }
}

export function advectVelocity(state: FluidState): void {
  state.uPrev.set(state.u);
  state.vPrev.set(state.v);

  for (let y = 1; y < state.rows - 1; y++) {
    for (let x = 1; x < state.cols - 1; x++) {
      const i = indexOf(state, x, y);

      const prevX = clampX(state, x - state.uPrev[i] * state.dt);
      const prevY = clampY(state, y - state.vPrev[i] * state.dt);

      state.u[i] =
        sampleField(state, state.uPrev, prevX, prevY) * state.velocityDamping;
      state.v[i] =
        sampleField(state, state.vPrev, prevX, prevY) * state.velocityDamping;
    }
  }
}

export function computeDivergence(state: FluidState): void {
  const h = 1.0;

  for (let y = 1; y < state.rows - 1; y++) {
    for (let x = 1; x < state.cols - 1; x++) {
      const i = indexOf(state, x, y);

      const uR = state.u[indexOf(state, x + 1, y)];
      const uL = state.u[indexOf(state, x - 1, y)];
      const vT = state.v[indexOf(state, x, y + 1)];
      const vB = state.v[indexOf(state, x, y - 1)];

      state.divergence[i] = ((uR - uL) + (vT - vB)) * 0.5 / h;
    }
  }
}

export function solvePressure(state: FluidState): void {
  state.pressure.fill(0);

  const h = 1.0;

  for (let iter = 0; iter < state.pressureIterations; iter++) {
    state.pressurePrev.set(state.pressure);

    for (let y = 1; y < state.rows - 1; y++) {
      for (let x = 1; x < state.cols - 1; x++) {
        const i = indexOf(state, x, y);

        const pL = state.pressurePrev[indexOf(state, x - 1, y)];
        const pR = state.pressurePrev[indexOf(state, x + 1, y)];
        const pB = state.pressurePrev[indexOf(state, x, y - 1)];
        const pT = state.pressurePrev[indexOf(state, x, y + 1)];

        state.pressure[i] =
          (pL + pR + pB + pT - state.divergence[i] * h * h) * 0.25;
      }
    }
  }
}

export function projectVelocity(state: FluidState): void {
  const h = 1.0;

  for (let y = 1; y < state.rows - 1; y++) {
    for (let x = 1; x < state.cols - 1; x++) {
      const i = indexOf(state, x, y);

      const pR = state.pressure[indexOf(state, x + 1, y)];
      const pL = state.pressure[indexOf(state, x - 1, y)];
      const pT = state.pressure[indexOf(state, x, y + 1)];
      const pB = state.pressure[indexOf(state, x, y - 1)];

      state.u[i] -= (pR - pL) * 0.5 / h;
      state.v[i] -= (pT - pB) * 0.5 / h;
    }
  }
}

export function applyBoundaries(state: FluidState): void {
  for (let x = 0; x < state.cols; x++) {
    state.u[indexOf(state, x, 0)] = 0;
    state.v[indexOf(state, x, 0)] = 0;
    state.u[indexOf(state, x, state.rows - 1)] = 0;
    state.v[indexOf(state, x, state.rows - 1)] = 0;
  }

  for (let y = 0; y < state.rows; y++) {
    state.u[indexOf(state, 0, y)] = 0;
    state.v[indexOf(state, 0, y)] = 0;
    state.u[indexOf(state, state.cols - 1, y)] = 0;
    state.v[indexOf(state, state.cols - 1, y)] = 0;
  }
}

export function stepFluid(state: FluidState): void {
  advectVelocity(state);
  applyBoundaries(state);

  computeDivergence(state);
  solvePressure(state);
  projectVelocity(state);
  applyBoundaries(state);

  state.densityPrev.set(state.density);
  advectScalar(state, state.densityPrev, state.density);

  for (let i = 0; i < state.density.length; i++) {
    state.density[i] *= state.densityDamping;
  }
}

/**
 * 流体の状態を指定したキャンバスにレンダリングします。
 * @param state 流体の状態
 * @param ctx レンダリングに使用するキャンバスのコンテキスト
 */
export function renderFluid(
  state: FluidState,
  ctx: CanvasRenderingContext2D
): void {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const renderBuffer = getRenderBuffer(state.cols, state.rows, canvas);

  ctx.clearRect(0, 0, width, height);

  const imageData = renderBuffer.ctx.createImageData(state.cols, state.rows);
  const pixels = imageData.data;

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const i = indexOf(state, x, y);
      const d = clamp(state.density[i], 0, 1);
      const speed = Math.hypot(state.u[i], state.v[i]);
      const activity = clamp(speed / 8, 0, 1);
      const visible = d * activity;

      state.cellAlpha[i] += (visible - state.cellAlpha[i]) * 0.18;

      if (state.cellAlpha[i] <= 0.01) continue;

      const alpha = clamp(state.cellAlpha[i] * 0.95, 0, 0.9);
      const red = Math.floor(10 + activity * 8);
      const green = Math.floor(70 + activity * 35);
      const blue = Math.floor(170 + activity * 65);
      const p = i * 4;

      pixels[p] = red;
      pixels[p + 1] = green;
      pixels[p + 2] = blue;
      pixels[p + 3] = Math.floor(alpha * 255);
    }
  }

  renderBuffer.ctx.putImageData(imageData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(renderBuffer.canvas, 0, 0, width, height);
}

/**
 * マウスポインタの動きに応じて流体に力と密度を注入します。
 * @param state 流体の状態
 * @param mouse マウスの状態
 * @returns void
 */
export function injectFromMouse(
  state: FluidState,
  mouse: MouseState
): void {
  if (!mouse.moved) return;

  const dx = mouse.x - mouse.px;
  const dy = mouse.y - mouse.py;

  addVelocity(
    state,
    mouse.x,
    mouse.y,
    6,
    dx * state.forceScale,
    dy * state.forceScale
  );

  addDensity(state, mouse.x, mouse.y, 7, state.densityAmount);

  mouse.px = mouse.x;
  mouse.py = mouse.y;
  mouse.moved = false;
}

/**
 * Fluid シミュレーションを指定したキャンバスにマウントします。
 * キャンバスのサイズに合わせてシミュレーションが自動的に調整されます。
 * マウント後は、キャンバス上でマウスポインタを動かすと流体が発生します。
 * @param canvas マウントするキャンバス要素
 * @returns アンマウント関数
 */
export function mountFluid(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("CanvasRenderingContext2D を取得できませんでした。");
  }

  resizeCanvasToDisplaySize(canvas);

  let state = createFluidState(canvas.width, canvas.height, 3);
  const mouse = createMouseState();

  let animationId = 0;

  const handleResize = (): void => {
    resizeCanvasToDisplaySize(canvas);
    state = createFluidState(canvas.width, canvas.height, 3);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    const pos = toGridPosition(
      canvas,
      state.cellSize,
      event.clientX,
      event.clientY
    );

    if (!mouse.initialized) {
      mouse.x = pos.x;
      mouse.y = pos.y;
      mouse.px = pos.x;
      mouse.py = pos.y;
      mouse.moved = true;
      mouse.initialized = true;
      return;
    }

    mouse.x = pos.x;
    mouse.y = pos.y;
    mouse.moved = true;
  };

  const tick = (): void => {
    injectFromMouse(state, mouse);
    stepFluid(state);
    renderFluid(state, ctx);
    animationId = window.requestAnimationFrame(tick);
  };

  window.addEventListener("resize", handleResize);
  canvas.addEventListener("pointermove", handlePointerMove);

  tick();

  return () => {
    window.cancelAnimationFrame(animationId);
    window.removeEventListener("resize", handleResize);
    canvas.removeEventListener("pointermove", handlePointerMove);
  };
}
