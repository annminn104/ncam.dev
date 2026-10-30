import { describe, expect, it } from 'vitest';
import type { TrackView } from '../bridge';
import { UPCOMING } from '../view';
import {
  DISC_COPIES,
  RACK_SLOTS,
  classifyChange,
  emptyShelf,
  fillShelf,
  lineupOf,
  shelfMatches,
  sizeFor,
  targetOf,
  type Lineup,
} from './stage';

const track = (id: string): TrackView => ({
  id,
  title: id,
  artists: 'A',
  artUrl: null,
  artistUrl: null,
  palette: null,
});
const MIX = { name: 'Mix', subtitle: 'Owner' };
/** `current` in the player (null: nothing), the rest coming next. */
const lineup = (current: string | null, ...upcoming: string[]): Lineup => ({
  collection: MIX,
  current: current === null ? null : track(current),
  upcoming: upcoming.map(track),
});

describe('the stage', () => {
  it('has a slot for each upcoming track the view carries, and a copy per place and one leaving', () => {
    expect(RACK_SLOTS).toBe(UPCOMING);
    expect(RACK_SLOTS).toBe(5);
    expect(DISC_COPIES).toBe(7);
  });

  it('prints the spindle’s disc and slot 0’s at 1024 px, the rest of the rack at 512', () => {
    expect([sizeFor('spindle'), sizeFor(0), sizeFor(1), sizeFor(4)]).toEqual([
      1024, 1024, 512, 512,
    ]);
  });

  it('targets what a view shows: the booklet is the track in the player, else the next', () => {
    expect(targetOf(lineup('a', 'b')).booklet?.id).toBe('a');
    expect(targetOf(lineup(null, 'b')).booklet?.id).toBe('b');
    expect(targetOf(lineup(null)).booklet).toBeNull();
    expect(targetOf(lineup('a', 'b'), track('x')).current?.id).toBe('x');
    expect(targetOf(lineup('a', 'b', 'c', 'd', 'e', 'f', 'g')).upcoming).toHaveLength(5);
  });

  it('fills a shelf at once, the spindle’s copy first, and reads it back', () => {
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c')));
    expect(shelf).toMatchObject({ spindle: 0, rack: [1, 2, null, null, null] });
    expect(lineupOf(shelf)).toEqual(lineup('a', 'b', 'c'));
    expect(fillShelf(targetOf(lineup(null, 'b'))).rack).toEqual([0, null, null, null, null]);
    expect(lineupOf(emptyShelf())).toEqual({ collection: null, current: null, upcoming: [] });
  });

  it('matches a shelf to a target by its tracks, the collection’s label aside', () => {
    const shelf = fillShelf(targetOf(lineup('a', 'b', 'c')));
    expect(shelfMatches(shelf, targetOf(lineup('a', 'b', 'c')))).toBe(true);
    const renamed = { ...lineup('a', 'b', 'c'), collection: { name: 'Renamed', subtitle: '' } };
    expect(shelfMatches(shelf, targetOf(renamed))).toBe(true);
    expect(shelfMatches(shelf, targetOf(lineup('a', 'c', 'b')))).toBe(false);
    expect(shelfMatches(shelf, targetOf(lineup('a', 'b')))).toBe(false);
    expect(shelfMatches(shelf, targetOf(lineup(null, 'b', 'c')))).toBe(false);
  });
});

describe('classifyChange', () => {
  const before = lineup('a', 'b', 'c', 'd', 'e', 'f');

  it('reads slot 0’s track as next, or as the first play with nothing on the spindle', () => {
    expect(classifyChange(before, lineup('b', 'c', 'd', 'e', 'f', 'g'), track('b'))).toEqual({
      kind: 'next',
      slot: 0,
    });
    const waiting = lineup(null, 'a', 'b', 'c', 'd', 'e');
    expect(classifyChange(waiting, lineup('a', 'b', 'c', 'd', 'e', 'f'), track('a'))).toEqual({
      kind: 'first',
      slot: 0,
    });
  });

  it('reads the track in the player coming next again as prev', () => {
    const later = lineup('b', 'c', 'd', 'e', 'f', 'g');
    expect(classifyChange(later, lineup('a', 'b', 'c', 'd', 'e', 'f'), track('a'))).toEqual({
      kind: 'prev',
      slot: null,
    });
  });

  it('reads a track further down the rack as a pick from its slot', () => {
    expect(classifyChange(before, lineup('d', 'e', 'f', 'g', 'h', 'i'), track('d'))).toEqual({
      kind: 'pick',
      slot: 2,
    });
  });

  it('reads any other track as coming from the side, against an empty rack too', () => {
    expect(classifyChange(before, lineup('x', 'y', 'z'), track('x'))).toEqual({
      kind: 'side',
      slot: null,
    });
    expect(classifyChange(lineup('a'), lineup('x'), track('x'))).toEqual({
      kind: 'side',
      slot: null,
    });
  });

  it('reads another collection as one, with a swap or without, and a view changed alone as a restack', () => {
    const other: Lineup = {
      ...lineup(null, 'p', 'q'),
      collection: { name: 'Other', subtitle: 'X' },
    };
    expect(classifyChange(before, other, null)).toEqual({ kind: 'collection', slot: null });
    expect(classifyChange(before, { ...other, current: track('p') }, track('p'))).toEqual({
      kind: 'collection',
      slot: null,
    });
    expect(classifyChange(before, lineup('a', 'f', 'e', 'd', 'c', 'b'), null)).toEqual({
      kind: 'restack',
      slot: null,
    });
  });

  it('takes, of two slots holding one track, the one whose next slot holds what comes next', () => {
    // The playlist holds b twice, in slots 0 and 2.
    const twice = lineup('a', 'b', 'c', 'b', 'd', 'e');
    expect(classifyChange(twice, lineup('b', 'd', 'e', 'f'), track('b'))).toEqual({
      kind: 'pick',
      slot: 2,
    });
    expect(classifyChange(twice, lineup('b', 'c', 'b', 'd', 'e'), track('b'))).toEqual({
      kind: 'next',
      slot: 0,
    });
  });

  it('reads prev before next where a track repeats right behind the one playing', () => {
    // [x, y, x] with y playing: Previous brings the first x back, and y comes next again.
    expect(classifyChange(lineup('y', 'x'), lineup('x', 'y', 'x'), track('x'))).toEqual({
      kind: 'prev',
      slot: null,
    });
  });
});
