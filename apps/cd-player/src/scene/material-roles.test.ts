import { describe, expect, it } from 'vitest';
import { CLEAR_PARTS } from '../clear-looks';
import { CLEAR_ROLES, MATERIAL_ROLES, SKIN_ROLES } from './material-roles';

describe('SKIN_ROLES', () => {
  // The Cycles renders (build_materials in art/blender/scripts/parts.py) colour each skin role
  // through the material named after it: a material mapped under another name would keep
  // Blender's colour in the renders while the page recolours it.
  it('maps every skin role to the material named after it, as the Blender renders do', () => {
    for (const [name, role] of Object.entries(SKIN_ROLES)) expect(role, name).toBe(name);
  });
});

describe('CLEAR_ROLES', () => {
  it('names materials the model has a role for, and each Clear part exactly once', () => {
    for (const name of Object.keys(CLEAR_ROLES)) expect(MATERIAL_ROLES[name], name).toBeDefined();
    expect(Object.values(CLEAR_ROLES).sort()).toEqual([...CLEAR_PARTS].sort());
  });
});
