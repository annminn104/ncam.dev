import { describe, expect, it } from 'vitest';
import {
  CD_MATERIALS,
  CD_NODES,
  DYNAMIC_MATERIALS,
  MATERIALS_BY_MEDIA,
  NODES_BY_MEDIA,
  PRINTED_MATERIALS,
  REQUIRED_NODES,
  SHARED_MATERIALS,
  SHARED_NODES,
  TURNTABLE_MATERIALS,
  TURNTABLE_NODES,
  VINYL_MATERIALS,
  VINYL_NODES,
} from './contract';

/** The CD player's contract as it stood before the split (2026-11-13): it must not move. */
const CD_CONTRACT = [
  'lid_hinge',
  'arm_pivot',
  'knob',
  'btn_prev',
  'btn_next',
  'btn_play',
  'btn_stop',
  'btn_rpt',
  'btn_mode',
  'icon_play',
  'icon_pause',
  'disc',
  'case',
  'case_lid_hinge',
  'card',
  'tag',
  'disc_seat',
  'case_seat',
  ...[0, 1, 2, 3, 4].map((i) => `rack_slot_${i}`),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `vu_seg_${i}`),
];
const CD_PRINTS = ['art_disc', 'art_booklet', 'card_print', 'tag_print', 'lcd_screen'];

describe('the contract by media', () => {
  it('keeps the CD player’s nodes and prints exactly as they were', () => {
    expect([...REQUIRED_NODES].sort()).toEqual([...CD_CONTRACT].sort());
    expect(REQUIRED_NODES).toHaveLength(CD_CONTRACT.length);
    expect([...DYNAMIC_MATERIALS].sort()).toEqual([...CD_PRINTS].sort());
    expect(NODES_BY_MEDIA.cd).toBe(REQUIRED_NODES);
    expect(MATERIALS_BY_MEDIA.cd).toBe(DYNAMIC_MATERIALS);
  });

  it('puts every name in one list only: the shared, the CD player’s or the turntable’s', () => {
    const lists = [SHARED_NODES, CD_NODES, VINYL_NODES].map((list) => new Set<string>(list));
    for (const name of [...SHARED_NODES, ...CD_NODES, ...VINYL_NODES]) {
      expect(
        lists.filter((list) => list.has(name)),
        name,
      ).toHaveLength(1);
    }
    const prints = [SHARED_MATERIALS, CD_MATERIALS, VINYL_MATERIALS].map(
      (list) => new Set<string>(list),
    );
    for (const name of PRINTED_MATERIALS) {
      expect(
        prints.filter((list) => list.has(name)),
        name,
      ).toHaveLength(1);
    }
  });

  it('gives a turntable no knob, lid, case, tag or VU strip, and its platter, arm head, sleeve and ledge', () => {
    for (const name of ['knob', 'lid_hinge', 'case', 'case_lid_hinge', 'case_seat', 'tag']) {
      expect(TURNTABLE_NODES, name).not.toContain(name);
    }
    for (let i = 0; i < 10; i++) expect(TURNTABLE_NODES).not.toContain(`vu_seg_${i}`);
    for (const name of [...SHARED_NODES, 'platter', 'arm_head', 'sleeve', 'sleeve_seat']) {
      expect(TURNTABLE_NODES, name).toContain(name);
    }
    expect([...TURNTABLE_MATERIALS].sort()).toEqual(['art_disc', 'art_sleeve', 'card_print']);
    expect(NODES_BY_MEDIA.vinyl).toBe(TURNTABLE_NODES);
    expect(MATERIALS_BY_MEDIA.vinyl).toBe(TURNTABLE_MATERIALS);
  });
});
