/**
 * Shared between the controls and the camera. `controlActive` says that the latest pointerdown on
 * the canvas went to a key or the knob: that press does not orbit, and a double-click or tap that
 * ends it does not recentre. The camera clears it on every pointerdown; R3F's handler for the same
 * event (bound to the canvas's parent, so it runs after the camera's) sets it again for a control.
 * The camera also says when two touches pinch the canvas: `pinching` while they do (a touch that
 * lands then presses nothing), and `pinches`, how many pinches have begun, so a touch on a key or
 * the knob can tell that one began while it was down, and let go.
 */
export const interaction = { controlActive: false, pinching: false, pinches: 0 };

/**
 * Whether a pointer that went down on the canvas has lost its release: the mouse moving with no
 * button down (a native menu opened and took the release, say). Touch and pen keep their contact
 * until a pointerup or a pointercancel says otherwise, whatever `buttons` reads.
 */
export function releaseLost(event: Pick<PointerEvent, 'pointerType' | 'buttons'>): boolean {
  return event.pointerType === 'mouse' && event.buttons === 0;
}
