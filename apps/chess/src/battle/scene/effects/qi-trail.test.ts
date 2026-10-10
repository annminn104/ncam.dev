import { Color, Vector3, type BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { MOVE_MS, TRAIL_MS, glideAt, trailSpan, type Glide } from '../glide';
import { RIBBON_POINTS, RIBBON_WIDTH, RIBBON_Y, ribbonGeometry, writeRibbon } from './qi-trail';

const glide = (elapsed: number): Glide => ({
  from: [-0.5, 2.5],
  fromY: 0.25,
  to: [-0.5, 0.5],
  elapsed,
});
const EYE = new Vector3(0, 8, 11);

const vertex = (pos: BufferAttribute, i: number) =>
  new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));

describe('ribbonGeometry', () => {
  it('is a strip of RIBBON_POINTS pairs in the sect colour, clear at the tail and solid at the head', () => {
    const g = ribbonGeometry('#ff3355');
    expect(g.getAttribute('position').count).toBe(RIBBON_POINTS * 2);
    expect(g.getIndex()?.count).toBe((RIBBON_POINTS - 1) * 6);
    const color = g.getAttribute('color');
    expect(color.itemSize).toBe(4);
    const crimson = new Color('#ff3355');
    for (let i = 0; i < color.count; i++) {
      expect(color.getX(i)).toBeCloseTo(crimson.r);
      expect(color.getY(i)).toBeCloseTo(crimson.g);
      expect(color.getZ(i)).toBeCloseTo(crimson.b);
    }
    expect(color.getW(0)).toBe(0);
    expect(color.getW(color.count - 1)).toBe(1);
    for (let i = 2; i < color.count; i += 2)
      expect(color.getW(i)).toBeGreaterThan(color.getW(i - 2));
  });
});

describe('writeRibbon', () => {
  it('has nothing to draw at take-off or once the trail has landed', () => {
    const g = ribbonGeometry('#5ef2ff');
    expect(writeRibbon(g, glide(0), EYE)).toBe(false);
    expect(writeRibbon(g, glide(MOVE_MS + TRAIL_MS), EYE)).toBe(false);
  });

  it('runs from the piece back along its arc, full width at the piece and none at the tail', () => {
    const g = ribbonGeometry('#5ef2ff');
    const flight = glide(MOVE_MS * 0.8);
    expect(writeRibbon(g, flight, EYE)).toBe(true);
    const pos = g.getAttribute('position') as BufferAttribute;
    const span = trailSpan(flight.elapsed);
    if (!span) throw new Error('no trail mid-flight');
    const [tail, head] = span;
    const piece = glideAt(flight, head, { x: 0, y: 0, z: 0 });
    const last = RIBBON_POINTS - 1;
    const a = vertex(pos, last * 2);
    const b = vertex(pos, last * 2 + 1);
    const middle = a.clone().add(b).multiplyScalar(0.5);
    expect(middle.distanceTo(new Vector3(piece.x, piece.y + RIBBON_Y, piece.z))).toBeLessThan(1e-6);
    expect(a.distanceTo(b)).toBeCloseTo(RIBBON_WIDTH);
    const start = glideAt(flight, tail, { x: 0, y: 0, z: 0 });
    expect(vertex(pos, 0).distanceTo(vertex(pos, 1))).toBeLessThan(1e-6);
    expect(
      vertex(pos, 0).distanceTo(new Vector3(start.x, start.y + RIBBON_Y, start.z)),
    ).toBeLessThan(1e-6);
  });

  it('turns its face to the camera all along', () => {
    const g = ribbonGeometry('#5ef2ff');
    writeRibbon(g, glide(MOVE_MS * 0.6), EYE);
    const pos = g.getAttribute('position') as BufferAttribute;
    // From a quarter of the way along: nearer the tail the strip is too narrow for float32
    // positions to say which way it faces.
    for (let i = Math.ceil(RIBBON_POINTS / 4); i < RIBBON_POINTS; i++) {
      const a = vertex(pos, i * 2);
      const b = vertex(pos, i * 2 + 1);
      const across = a.clone().sub(b).normalize();
      const centre = a.clone().add(b).multiplyScalar(0.5);
      const toEye = EYE.clone().sub(centre).normalize();
      expect(Math.abs(across.dot(toEye))).toBeLessThan(1e-4);
    }
  });

  it('stays finite seen end-on', () => {
    const g = ribbonGeometry('#5ef2ff');
    // A camera straight down the line of a glide that has no arc to speak of yet.
    writeRibbon(g, glide(MOVE_MS * 0.05), new Vector3(-0.5, RIBBON_Y + 0.25, 40));
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
  });
});
