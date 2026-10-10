import { describe, it, expect } from 'vitest';
import { makeValue, animate, prefersReducedMotion } from './animate';

describe('animate', () => {
  it('supports get/set/jump and change subscriptions', () => {
    const value = makeValue(5);
    expect(value.get()).toBe(5);

    const seen = [];
    const off = value.on('change', (x) => seen.push(x));
    value.set(10);
    expect(value.get()).toBe(10);
    expect(seen).toEqual([10]);

    off();
    value.set(11);
    expect(seen).toEqual([10]);

    value.jump(3);
    expect(value.get()).toBe(3);
    expect(value.getVelocity()).toBe(0);
  });

  it('starts spring and tween animations and can be stopped', () => {
    const value = makeValue(0);
    value.spring(1, { duration: 0.01 });
    value.stop();
    animate(value, 5, { type: 'spring' });
    animate(value, 5, { duration: 0 });
    value.stop();
  });

  it('reflects the app-wide reduce-motion attribute', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    expect(prefersReducedMotion()).toBe(true);
    document.documentElement.setAttribute('data-reduce-motion', 'false');
    expect(prefersReducedMotion()).toBe(false);
  });
});
