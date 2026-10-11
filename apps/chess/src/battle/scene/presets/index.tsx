import type { ComponentType } from 'react';
import type { BoardPiece } from '../../../game/pieces';
import { presetMeta, type PresetId, type PresetKind } from '../../../presets-meta';
import { Treasure } from '../pieces';

export interface PresetPieceProps {
  preset: PresetId;
  piece: BoardPiece;
  jumping: boolean;
}

/**
 * Renderers by preset kind. 'treasure' is the original set and 'figure' the Blender-built ones
 * (presets/figure, registered when Battle imports it). A kind with no renderer yet draws the
 * treasures, so a preset still being built never breaks a battle.
 */
const RENDERERS: Partial<Record<PresetKind, ComponentType<PresetPieceProps>>> = {};

/**
 * A renderer module calls this as it is imported (Battle imports it), which keeps this file free
 * of the heavy renderers. One renderer per kind: it draws every preset of that kind.
 */
export function registerRenderer(
  kind: PresetKind,
  renderer: ComponentType<PresetPieceProps>,
): void {
  RENDERERS[kind] = renderer;
}

/** A piece drawn by its owner's piece set. */
export function PresetPiece(props: PresetPieceProps) {
  const Renderer = RENDERERS[presetMeta(props.preset).kind];
  return Renderer ? (
    <Renderer {...props} />
  ) : (
    <Treasure piece={props.piece} jumping={props.jumping} />
  );
}
