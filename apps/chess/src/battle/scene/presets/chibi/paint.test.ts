import { BoxGeometry, SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { mergePainted, outlineHull, paint, triangles } from './paint';

describe('paint / merge / hull', () => {
  it('paints a uniform colour attribute', () => {
    const g = paint(new BoxGeometry(1, 1, 1), '#ff0000');
    const c = g.getAttribute('color');
    expect(c.count).toBe(g.getAttribute('position').count);
    expect([c.getX(0), c.getY(0), c.getZ(0)].map((v) => +v.toFixed(2))).toEqual([1, 0, 0]);
  });
  it('merges painted parts keeping only position, normal and colour', () => {
    const box = new BoxGeometry();
    const ball = new SphereGeometry(0.5, 8, 6);
    const expected = triangles(box) + triangles(ball);
    const m = mergePainted([paint(box, '#fff'), paint(ball, '#000')]);
    expect(Object.keys(m.attributes).sort()).toEqual(['color', 'normal', 'position']);
    expect(triangles(m)).toBe(expected);
  });
  it('inflates a hull along smooth normals', () => {
    const s = new SphereGeometry(1, 16, 12);
    const h = outlineHull(paint(s, '#fff'), 0.05);
    h.computeBoundingSphere();
    expect(h.boundingSphere!.radius).toBeCloseTo(1.05, 2);
  });
});
