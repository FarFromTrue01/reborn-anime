// Small deterministic math helpers. Nothing in the film may use Math.random():
// every value must be derivable from the frame time `t` alone.

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const smooth = (a: number, b: number, v: number) => {
  const k = invLerp(a, b, v);
  return k * k * (3 - 2 * k);
};
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = (k: number) => Math.pow(clamp(k), 3);
/** 0→1→0 window: rises over [a,b], holds, falls over [c,d]. */
export const win = (t: number, a: number, b: number, c: number, d: number) =>
  smooth(a, b, t) * (1 - smooth(c, d, t));

/** Integer hash → [0,1). Stable across browsers. */
export function hash(n: number, seed = 0): number {
  let x = (Math.floor(n) * 374761393 + seed * 668265263) | 0;
  x = (x ^ (x >>> 13)) * 1274126177;
  x = x ^ (x >>> 16);
  return ((x >>> 0) % 1000003) / 1000003;
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise in [-1,1]. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}

export type RGB = [number, number, number];
export function hex(c: string): RGB {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgba(c: string | RGB, a = 1): string {
  const [r, g, b] = typeof c === 'string' ? hex(c) : c;
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
export function mix(c1: string, c2: string, k: number): string {
  const a = hex(c1);
  const b = hex(c2);
  const r = a.map((v, i) => Math.round(lerp(v, b[i], k)));
  return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export type Pt = { x: number; y: number };
export const P = (x: number, y: number): Pt => ({ x, y });
