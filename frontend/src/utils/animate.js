// Vanilla animation engine — springs + tweens driven by one shared rAF loop.
// Replaces the `motion` dependency (imported only by RubberSegment) with the
// same physics as the sandbox port in performa-minimal/react-bits.js, so the
// app ships no animation library. Values expose the small surface the
// components actually use: get / set / jump / stop / getVelocity / on / animate.
//
// AGENTS.md §1.9: motion is functional only; callers gate on prefersReducedMotion.

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// CSS-style cubic-bezier [x1,y1,x2,y2] → easing function, so callers can pass
// the same arrays `motion` accepted (e.g. RubberSegment's EASE_OUT).
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-5) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(t);
  };
}

const values = [];
let raf = 0;
let last = 0;

function loop(now) {
  const dt = Math.min(0.032, (now - last) / 1000) || 0.016;
  last = now;
  let any = false;
  for (const v of values) {
    v._step(now, dt);
    if (v._active) any = true;
  }
  raf = any ? requestAnimationFrame(loop) : 0;
}

function kick() {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

// OS preference OR the app-wide setting (data-reduce-motion on <html>).
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  const osPrefers =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const appPrefers =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-reduce-motion') === 'true';
  return osPrefers || appPrefers;
}

// A single animated scalar. `spring`/`tween` are driven by the shared loop;
// `jump`/`set` apply immediately. `on('change', cb)` returns an unsubscribe.
export function makeValue(init) {
  const v = {
    x: init,
    vel: 0,
    _active: false,
    _mode: 'idle',
    _target: init,
    _k: 0,
    _c: 0,
    _from: init,
    _t0: 0,
    _dur: 0,
    _ease: null,
    _onDone: null,
    _listeners: null,

    get() {
      return v.x;
    },
    set(t) {
      v.x = t;
      v._notify();
    },
    jump(t) {
      v.x = t;
      v.vel = 0;
      v._target = t;
      v._active = false;
      v._mode = 'idle';
      v._notify();
    },
    stop() {
      v._active = false;
      v._mode = 'idle';
      v._onDone = null;
    },
    getVelocity() {
      return v.vel;
    },
    on(evt, cb) {
      if (evt !== 'change') return () => {};
      if (!v._listeners) v._listeners = new Set();
      v._listeners.add(cb);
      return () => v._listeners && v._listeners.delete(cb);
    },
    _notify() {
      if (v._listeners) for (const cb of v._listeners) cb(v.x);
    },

    // duration (s) + bounce (0..1) map to stiffness/damping, as in `motion`.
    spring(target, o) {
      o = o || {};
      const duration = o.duration != null ? o.duration : 0.3;
      const bounce = o.bounce != null ? o.bounce : 0;
      const w = (2 * Math.PI) / duration;
      const z = 1 - clamp(bounce, 0, 0.99);
      v._k = w * w;
      v._c = 2 * z * w;
      v._mode = 'spring';
      v._target = target;
      v._active = true;
      v._onDone = o.onDone || null;
      if (o.velocity != null) v.vel = o.velocity;
      kick();
    },
    tween(target, o) {
      o = o || {};
      v._mode = 'tween';
      v._from = v.x;
      v._target = target;
      v._t0 = performance.now();
      v._dur = (o.duration != null ? o.duration : 0.2) * 1000;
      const ease = o.ease;
      v._ease =
        typeof ease === 'function'
          ? ease
          : Array.isArray(ease)
          ? bezier(ease[0], ease[1], ease[2], ease[3])
          : (p) => p;
      v._active = true;
      v._onDone = o.onDone || null;
      kick();
    },

    _step(now, dt) {
      if (!v._active) return;
      if (v._mode === 'tween') {
        const p = Math.min(1, (now - v._t0) / v._dur);
        v.x = v._from + (v._target - v._from) * v._ease(p);
        v._notify();
        if (p >= 1) {
          v._active = false;
          const d = v._onDone;
          v._onDone = null;
          if (d) d();
        }
      } else {
        const a = v._k * (v._target - v.x) - v._c * v.vel;
        v.vel += a * dt;
        v.x += v.vel * dt;
        v._notify();
        if (Math.abs(v._target - v.x) < 0.3 && Math.abs(v.vel) < 0.3) {
          v.x = v._target;
          v.vel = 0;
          v._active = false;
          const d = v._onDone;
          v._onDone = null;
          if (d) d();
        }
      }
    },
  };
  values.push(v);
  return v;
}

// `motion`-style entry point: animate(value, target, { type, ... }).
export function animate(value, target, opts) {
  if (opts && opts.type === 'spring') value.spring(target, opts);
  else value.tween(target, opts);
}
