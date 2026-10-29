/**
 * Shared between the controls and the camera: a pointer that went down on a key or the knob does
 * not orbit. R3F's handler for that pointerdown runs before the first pointermove reaches the rig.
 */
export const interaction = { controlActive: false };
