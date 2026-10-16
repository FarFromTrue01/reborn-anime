// Master GSAP timeline. It is never "played": the film seeks it to `t` every
// frame, so all tweened values are a pure function of time.
import gsap from 'gsap';

export const master = gsap.timeline({ paused: true });

type Key = [time: number, value: number, ease?: string];

/**
 * Keyframe a numeric property with absolute film times.
 * Implemented as chained fromTo tweens so seeking in any order is exact.
 */
export function keys<T extends object>(target: T, prop: keyof T & string, list: Key[]) {
  (target as any)[prop] = list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [t0, v0] = list[i - 1];
    const [t1, v1, ease] = list[i];
    master.fromTo(
      target,
      { [prop]: v0 },
      { [prop]: v1, duration: Math.max(0.0001, t1 - t0), ease: ease ?? 'sine.inOut', immediateRender: false },
      t0,
    );
  }
}

/** Seek every tween to film time t (no callbacks fire). */
export function seek(t: number) {
  master.seek(t, true);
}
