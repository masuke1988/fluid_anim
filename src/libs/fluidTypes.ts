export type Vec2 = {
  x: number;
  y: number;
};

export type MouseState = {
  x: number;
  y: number;
  px: number;
  py: number;
  down: boolean;
  moved: boolean;
  initialized: boolean;
};

export type FluidState = {
  cols: number;
  rows: number;
  cellSize: number;
  dt: number;
  pressureIterations: number;
  velocityDamping: number;
  densityDamping: number;
  forceScale: number;
  densityAmount: number;
  cellAlpha: Float32Array;

  u: Float32Array;
  v: Float32Array;
  uPrev: Float32Array;
  vPrev: Float32Array;

  density: Float32Array;
  densityPrev: Float32Array;

  pressure: Float32Array;
  pressurePrev: Float32Array;
  divergence: Float32Array;
};
